"""
データバリデーター
マッピング処理で使用するデータ検証機能
"""
import logging
import re
from typing import Dict, List, Any, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """検証エラーの重要度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationRule:
    """検証ルール定義"""
    name: str
    field_name: str
    validator: Callable[[Any], bool]
    severity: ValidationSeverity
    message: str
    fix_suggestion: Optional[str] = None
    
    def validate(self, value: Any) -> bool:
        """値を検証"""
        try:
            return self.validator(value)
        except Exception as e:
            logger.warning(f"検証ルール実行エラー ({self.name}): {e}")
            return False


@dataclass
class ValidationResult:
    """検証結果"""
    is_valid: bool
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    info: List[Dict[str, Any]] = field(default_factory=list)
    total_records: int = 0
    valid_records: int = 0
    
    @property
    def success_rate(self) -> float:
        """成功率を計算"""
        if self.total_records == 0:
            return 0.0
        return self.valid_records / self.total_records
    
    def add_issue(self, severity: ValidationSeverity, field_name: str, 
                  value: Any, message: str, fix_suggestion: Optional[str] = None):
        """問題を追加"""
        issue = {
            "field_name": field_name,
            "value": str(value),
            "message": message,
            "fix_suggestion": fix_suggestion
        }
        
        if severity == ValidationSeverity.ERROR or severity == ValidationSeverity.CRITICAL:
            self.errors.append(issue)
        elif severity == ValidationSeverity.WARNING:
            self.warnings.append(issue)
        else:
            self.info.append(issue)


class DataValidator:
    """データバリデータークラス"""
    
    def __init__(self):
        self.rules: List[ValidationRule] = []
        self._default_rules_loaded = False
    
    def add_rule(self, rule: ValidationRule):
        """検証ルールを追加"""
        self.rules.append(rule)
        logger.debug(f"検証ルールを追加: {rule.name}")
    
    def remove_rule(self, rule_name: str):
        """検証ルールを削除"""
        self.rules = [rule for rule in self.rules if rule.name != rule_name]
        logger.debug(f"検証ルールを削除: {rule_name}")
    
    def load_default_rules(self):
        """デフォルトの検証ルールをロード"""
        if self._default_rules_loaded:
            return
        
        # 必須フィールド検証
        self.add_rule(ValidationRule(
            name="required_id",
            field_name="external_id",
            validator=lambda x: x is not None and str(x).strip() != "",
            severity=ValidationSeverity.ERROR,
            message="IDは必須項目です",
            fix_suggestion="有効なIDを設定してください"
        ))
        
        # メールアドレス検証
        self.add_rule(ValidationRule(
            name="valid_email",
            field_name="email",
            validator=self._is_valid_email,
            severity=ValidationSeverity.WARNING,
            message="メールアドレス形式が正しくありません",
            fix_suggestion="正しいメールアドレス形式で入力してください"
        ))
        
        # 価格検証
        self.add_rule(ValidationRule(
            name="positive_price",
            field_name="price",
            validator=lambda x: x is None or (isinstance(x, (int, float, Decimal)) and x >= 0),
            severity=ValidationSeverity.WARNING,
            message="価格は0以上である必要があります",
            fix_suggestion="正の数値を設定してください"
        ))
        
        # 在庫数検証
        self.add_rule(ValidationRule(
            name="non_negative_inventory",
            field_name="inventory_quantity",
            validator=lambda x: x is None or (isinstance(x, int) and x >= 0),
            severity=ValidationSeverity.WARNING,
            message="在庫数は0以上である必要があります",
            fix_suggestion="0以上の整数を設定してください"
        ))
        
        # 日付検証
        self.add_rule(ValidationRule(
            name="valid_date",
            field_name="created_at",
            validator=lambda x: x is None or isinstance(x, datetime),
            severity=ValidationSeverity.ERROR,
            message="日付形式が正しくありません",
            fix_suggestion="正しい日付形式で入力してください"
        ))
        
        self.add_rule(ValidationRule(
            name="valid_update_date",
            field_name="updated_at",
            validator=lambda x: x is None or isinstance(x, datetime),
            severity=ValidationSeverity.ERROR,
            message="更新日付形式が正しくありません",
            fix_suggestion="正しい日付形式で入力してください"
        ))
        
        # 文字列長検証
        self.add_rule(ValidationRule(
            name="name_length",
            field_name="name",
            validator=lambda x: x is None or len(str(x)) <= 255,
            severity=ValidationSeverity.WARNING,
            message="名前が長すぎます（255文字以内）",
            fix_suggestion="255文字以内に短縮してください"
        ))
        
        # ステータス検証
        self.add_rule(ValidationRule(
            name="valid_status",
            field_name="status",
            validator=lambda x: x is None or x in ["active", "inactive", "draft", "pending", "completed", "cancelled"],
            severity=ValidationSeverity.WARNING,
            message="無効なステータス値です",
            fix_suggestion="有効なステータス値を設定してください"
        ))
        
        # 通貨コード検証
        self.add_rule(ValidationRule(
            name="valid_currency",
            field_name="currency",
            validator=lambda x: x is None or (isinstance(x, str) and len(x) == 3 and x.isupper()),
            severity=ValidationSeverity.WARNING,
            message="通貨コードは3文字の大文字である必要があります",
            fix_suggestion="JPY, USD, EUR等の3文字通貨コードを使用してください"
        ))
        
        self._default_rules_loaded = True
        logger.info(f"デフォルト検証ルールをロード: {len(self.rules)}個")
    
    def validate_record(self, record: Dict[str, Any]) -> ValidationResult:
        """単一レコードを検証"""
        result = ValidationResult(is_valid=True, total_records=1)
        
        for rule in self.rules:
            if rule.field_name in record:
                value = record[rule.field_name]
                if not rule.validate(value):
                    result.is_valid = False
                    result.add_issue(
                        severity=rule.severity,
                        field_name=rule.field_name,
                        value=value,
                        message=rule.message,
                        fix_suggestion=rule.fix_suggestion
                    )
        
        if result.is_valid:
            result.valid_records = 1
        
        return result
    
    def validate_records(self, records: List[Dict[str, Any]]) -> ValidationResult:
        """複数レコードを検証"""
        if not records:
            return ValidationResult(is_valid=True, total_records=0, valid_records=0)
        
        total_result = ValidationResult(is_valid=True, total_records=len(records))
        
        for i, record in enumerate(records):
            record_result = self.validate_record(record)
            
            # 結果をマージ
            if record_result.is_valid:
                total_result.valid_records += 1
            else:
                total_result.is_valid = False
            
            # エラー情報を追加（レコード番号付き）
            for error in record_result.errors:
                error["record_index"] = i
                total_result.errors.append(error)
            
            for warning in record_result.warnings:
                warning["record_index"] = i
                total_result.warnings.append(warning)
            
            for info in record_result.info:
                info["record_index"] = i
                total_result.info.append(info)
        
        logger.info(f"検証完了: {total_result.valid_records}/{total_result.total_records} レコード成功")
        return total_result
    
    def _is_valid_email(self, email: Any) -> bool:
        """メールアドレス形式を検証"""
        if email is None:
            return True  # null値は許可
        
        if not isinstance(email, str):
            return False
        
        # 基本的なメールアドレスパターン
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email.strip()) is not None
    
    def get_validation_summary(self, result: ValidationResult) -> Dict[str, Any]:
        """検証結果のサマリーを取得"""
        return {
            "total_records": result.total_records,
            "valid_records": result.valid_records,
            "success_rate": result.success_rate,
            "error_count": len(result.errors),
            "warning_count": len(result.warnings),
            "info_count": len(result.info),
            "is_valid": result.is_valid
        }
    
    def create_validation_report(self, result: ValidationResult) -> str:
        """検証結果のレポートを作成"""
        report_lines = []
        report_lines.append("=== データ検証レポート ===")
        report_lines.append(f"総レコード数: {result.total_records}")
        report_lines.append(f"有効レコード数: {result.valid_records}")
        report_lines.append(f"成功率: {result.success_rate:.2%}")
        report_lines.append("")
        
        if result.errors:
            report_lines.append(f"エラー ({len(result.errors)}件):")
            for error in result.errors:
                record_info = f"レコード{error.get('record_index', 'N/A')}: " if 'record_index' in error else ""
                report_lines.append(f"  - {record_info}{error['field_name']}: {error['message']}")
        
        if result.warnings:
            report_lines.append(f"\n警告 ({len(result.warnings)}件):")
            for warning in result.warnings:
                record_info = f"レコード{warning.get('record_index', 'N/A')}: " if 'record_index' in warning else ""
                report_lines.append(f"  - {record_info}{warning['field_name']}: {warning['message']}")
        
        return "\n".join(report_lines)