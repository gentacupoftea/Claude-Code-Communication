"""
スキーマバリデーター
DWHスキーマとデータの整合性を検証
"""
import logging
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SchemaValidationError(Exception):
    """スキーマ検証エラー"""
    pass


class ValidationSeverity(Enum):
    """検証結果の重要度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationIssue:
    """検証問題"""
    severity: ValidationSeverity
    field_name: str
    issue_type: str
    message: str
    value: Any = None
    suggestion: Optional[str] = None


@dataclass
class SchemaValidationResult:
    """スキーマ検証結果"""
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    validated_records: int = 0
    
    def add_issue(self, severity: ValidationSeverity, field_name: str, 
                  issue_type: str, message: str, value: Any = None, 
                  suggestion: Optional[str] = None):
        """問題を追加"""
        issue = ValidationIssue(
            severity=severity,
            field_name=field_name,
            issue_type=issue_type,
            message=message,
            value=value,
            suggestion=suggestion
        )
        self.issues.append(issue)
        
        # エラーまたは重要な問題がある場合は無効とする
        if severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]:
            self.is_valid = False
    
    def get_issues_by_severity(self, severity: ValidationSeverity) -> List[ValidationIssue]:
        """重要度別の問題を取得"""
        return [issue for issue in self.issues if issue.severity == severity]
    
    def has_errors(self) -> bool:
        """エラーがあるかチェック"""
        return any(issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL] 
                  for issue in self.issues)


class SchemaValidator:
    """スキーマバリデータークラス"""
    
    def __init__(self, dwh_schema: Dict[str, Any]):
        """
        スキーマバリデーターの初期化
        
        Args:
            dwh_schema: DWHスキーマ定義
        """
        self.dwh_schema = dwh_schema
        self.table_schemas = dwh_schema.get("tables", {})
        self.validation_rules = dwh_schema.get("validation_rules", {})
        
        logger.info(f"スキーマバリデーター初期化: {len(self.table_schemas)}テーブル")

    def validate_table_schema(self, table_name: str, 
                            mapped_data: List[Dict[str, Any]]) -> SchemaValidationResult:
        """
        テーブルスキーマとデータの整合性を検証
        
        Args:
            table_name: テーブル名
            mapped_data: マッピング済みデータ
            
        Returns:
            検証結果
        """
        result = SchemaValidationResult(is_valid=True, validated_records=len(mapped_data))
        
        # テーブルスキーマの存在確認
        if table_name not in self.table_schemas:
            result.add_issue(
                ValidationSeverity.ERROR,
                "table",
                "schema_not_found",
                f"テーブルスキーマが見つかりません: {table_name}"
            )
            return result
        
        table_schema = self.table_schemas[table_name]
        
        if not mapped_data:
            result.add_issue(
                ValidationSeverity.WARNING,
                "data",
                "empty_data",
                "検証対象のデータが空です"
            )
            return result
        
        # スキーマ構造の検証
        self._validate_schema_structure(table_schema, result)
        
        # データレコードの検証
        for i, record in enumerate(mapped_data):
            self._validate_record_against_schema(
                record, table_schema, result, record_index=i
            )
        
        logger.info(f"スキーマ検証完了: {table_name}, 問題数={len(result.issues)}")
        return result

    def _validate_schema_structure(self, table_schema: Dict[str, Any], 
                                 result: SchemaValidationResult):
        """テーブルスキーマ構造の検証"""
        required_keys = ["fields"]
        for key in required_keys:
            if key not in table_schema:
                result.add_issue(
                    ValidationSeverity.ERROR,
                    "schema",
                    "missing_required_key",
                    f"スキーマに必須キー '{key}' がありません"
                )
        
        # フィールド定義の検証
        fields = table_schema.get("fields", {})
        if not fields:
            result.add_issue(
                ValidationSeverity.ERROR,
                "schema",
                "no_fields",
                "フィールド定義がありません"
            )
            return
        
        for field_name, field_def in fields.items():
            self._validate_field_definition(field_name, field_def, result)

    def _validate_field_definition(self, field_name: str, field_def: Dict[str, Any],
                                 result: SchemaValidationResult):
        """フィールド定義の検証"""
        required_field_keys = ["type"]
        for key in required_field_keys:
            if key not in field_def:
                result.add_issue(
                    ValidationSeverity.ERROR,
                    field_name,
                    "missing_field_property",
                    f"フィールド '{field_name}' に必須プロパティ '{key}' がありません"
                )
        
        # データ型の検証
        field_type = field_def.get("type")
        valid_types = [
            "string", "integer", "decimal", "boolean", "datetime", 
            "date", "json", "list", "text"
        ]
        if field_type not in valid_types:
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "invalid_field_type",
                f"無効なフィールドタイプ: {field_type}",
                suggestion=f"有効なタイプ: {', '.join(valid_types)}"
            )

    def _validate_record_against_schema(self, record: Dict[str, Any], 
                                      table_schema: Dict[str, Any],
                                      result: SchemaValidationResult,
                                      record_index: int):
        """レコードのスキーマ検証"""
        fields_schema = table_schema.get("fields", {})
        
        # 必須フィールドの検証
        self._validate_required_fields(record, fields_schema, result, record_index)
        
        # フィールド値の検証
        for field_name, value in record.items():
            if field_name in fields_schema:
                self._validate_field_value(
                    field_name, value, fields_schema[field_name], 
                    result, record_index
                )
            else:
                # 未定義フィールドの警告
                result.add_issue(
                    ValidationSeverity.WARNING,
                    field_name,
                    "undefined_field",
                    f"レコード{record_index}: 未定義フィールド '{field_name}'",
                    value=value
                )

    def _validate_required_fields(self, record: Dict[str, Any], 
                                fields_schema: Dict[str, Any],
                                result: SchemaValidationResult,
                                record_index: int):
        """必須フィールドの検証"""
        for field_name, field_def in fields_schema.items():
            is_required = field_def.get("required", False)
            if is_required and (field_name not in record or record[field_name] is None):
                result.add_issue(
                    ValidationSeverity.ERROR,
                    field_name,
                    "missing_required_field",
                    f"レコード{record_index}: 必須フィールド '{field_name}' がありません",
                    suggestion="必須フィールドに値を設定してください"
                )

    def _validate_field_value(self, field_name: str, value: Any, 
                            field_def: Dict[str, Any],
                            result: SchemaValidationResult,
                            record_index: int):
        """フィールド値の検証"""
        # null値の検証
        if value is None:
            nullable = field_def.get("nullable", True)
            if not nullable:
                result.add_issue(
                    ValidationSeverity.ERROR,
                    field_name,
                    "null_not_allowed",
                    f"レコード{record_index}: フィールド '{field_name}' にnull値は許可されていません",
                    value=value
                )
            return
        
        # データ型の検証
        self._validate_field_type(field_name, value, field_def, result, record_index)
        
        # 制約の検証
        self._validate_field_constraints(field_name, value, field_def, result, record_index)

    def _validate_field_type(self, field_name: str, value: Any, 
                           field_def: Dict[str, Any],
                           result: SchemaValidationResult,
                           record_index: int):
        """フィールドのデータ型検証"""
        expected_type = field_def.get("type")
        
        type_validators = {
            "string": lambda x: isinstance(x, str),
            "integer": lambda x: isinstance(x, int) and not isinstance(x, bool),
            "decimal": lambda x: isinstance(x, (int, float)) and not isinstance(x, bool),
            "boolean": lambda x: isinstance(x, bool),
            "datetime": lambda x: hasattr(x, 'strftime'),  # datetime object
            "date": lambda x: hasattr(x, 'strftime'),      # date object
            "json": lambda x: isinstance(x, (dict, list)),
            "list": lambda x: isinstance(x, list),
            "text": lambda x: isinstance(x, str)
        }
        
        validator = type_validators.get(expected_type)
        if validator and not validator(value):
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "type_mismatch",
                f"レコード{record_index}: フィールド '{field_name}' の型が不正です。期待: {expected_type}, 実際: {type(value).__name__}",
                value=value,
                suggestion=f"{expected_type}型に変換してください"
            )

    def _validate_field_constraints(self, field_name: str, value: Any,
                                  field_def: Dict[str, Any],
                                  result: SchemaValidationResult,
                                  record_index: int):
        """フィールド制約の検証"""
        # 長さ制約
        max_length = field_def.get("max_length")
        if max_length and isinstance(value, str) and len(value) > max_length:
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "max_length_exceeded",
                f"レコード{record_index}: フィールド '{field_name}' が最大長を超過しています。最大: {max_length}, 実際: {len(value)}",
                value=value,
                suggestion=f"{max_length}文字以内に短縮してください"
            )
        
        # 最小値制約
        min_value = field_def.get("min_value")
        if min_value is not None and isinstance(value, (int, float)) and value < min_value:
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "min_value_violation",
                f"レコード{record_index}: フィールド '{field_name}' が最小値を下回っています。最小: {min_value}, 実際: {value}",
                value=value,
                suggestion=f"{min_value}以上の値を設定してください"
            )
        
        # 最大値制約
        max_value = field_def.get("max_value")
        if max_value is not None and isinstance(value, (int, float)) and value > max_value:
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "max_value_violation",
                f"レコード{record_index}: フィールド '{field_name}' が最大値を超過しています。最大: {max_value}, 実際: {value}",
                value=value,
                suggestion=f"{max_value}以下の値を設定してください"
            )
        
        # 選択肢制約
        choices = field_def.get("choices")
        if choices and value not in choices:
            result.add_issue(
                ValidationSeverity.ERROR,
                field_name,
                "invalid_choice",
                f"レコード{record_index}: フィールド '{field_name}' の値が選択肢にありません。選択肢: {choices}, 実際: {value}",
                value=value,
                suggestion=f"有効な選択肢から選んでください: {', '.join(map(str, choices))}"
            )
        
        # パターン制約（正規表現）
        pattern = field_def.get("pattern")
        if pattern and isinstance(value, str):
            import re
            if not re.match(pattern, value):
                result.add_issue(
                    ValidationSeverity.ERROR,
                    field_name,
                    "pattern_mismatch",
                    f"レコード{record_index}: フィールド '{field_name}' がパターンに一致しません。パターン: {pattern}, 実際: {value}",
                    value=value,
                    suggestion=f"パターン {pattern} に一致する形式で入力してください"
                )

    def validate_cross_table_constraints(self, data: Dict[str, List[Dict[str, Any]]]) -> SchemaValidationResult:
        """テーブル間制約の検証"""
        result = SchemaValidationResult(is_valid=True)
        
        # 外部キー制約の検証
        self._validate_foreign_keys(data, result)
        
        # 参照整合性の検証
        self._validate_referential_integrity(data, result)
        
        return result

    def _validate_foreign_keys(self, data: Dict[str, List[Dict[str, Any]]], 
                             result: SchemaValidationResult):
        """外部キー制約の検証"""
        for table_name, records in data.items():
            if table_name not in self.table_schemas:
                continue
            
            table_schema = self.table_schemas[table_name]
            foreign_keys = table_schema.get("foreign_keys", {})
            
            for fk_field, fk_def in foreign_keys.items():
                ref_table = fk_def.get("references_table")
                ref_field = fk_def.get("references_field", "external_id")
                
                if ref_table not in data:
                    result.add_issue(
                        ValidationSeverity.WARNING,
                        fk_field,
                        "missing_reference_table",
                        f"参照テーブル '{ref_table}' のデータがありません"
                    )
                    continue
                
                # 参照先の値を収集
                ref_values = {
                    record.get(ref_field) for record in data[ref_table]
                    if record.get(ref_field) is not None
                }
                
                # 外部キーの値をチェック
                for i, record in enumerate(records):
                    fk_value = record.get(fk_field)
                    if fk_value is not None and fk_value not in ref_values:
                        result.add_issue(
                            ValidationSeverity.ERROR,
                            fk_field,
                            "foreign_key_violation",
                            f"テーブル '{table_name}' レコード{i}: 外部キー '{fk_field}' の参照先が見つかりません。値: {fk_value}",
                            value=fk_value
                        )

    def _validate_referential_integrity(self, data: Dict[str, List[Dict[str, Any]]], 
                                       result: SchemaValidationResult):
        """参照整合性の検証"""
        # 主キーの重複チェック
        for table_name, records in data.items():
            if table_name not in self.table_schemas:
                continue
            
            table_schema = self.table_schemas[table_name]
            primary_key = table_schema.get("primary_key", "external_id")
            
            seen_keys = set()
            for i, record in enumerate(records):
                key_value = record.get(primary_key)
                if key_value is not None:
                    if key_value in seen_keys:
                        result.add_issue(
                            ValidationSeverity.ERROR,
                            primary_key,
                            "duplicate_primary_key",
                            f"テーブル '{table_name}' レコード{i}: 主キー '{primary_key}' が重複しています。値: {key_value}",
                            value=key_value
                        )
                    else:
                        seen_keys.add(key_value)

    def create_validation_report(self, result: SchemaValidationResult) -> str:
        """検証結果のレポートを作成"""
        report_lines = []
        report_lines.append("=== スキーマ検証レポート ===")
        report_lines.append(f"検証結果: {'成功' if result.is_valid else '失敗'}")
        report_lines.append(f"検証レコード数: {result.validated_records}")
        report_lines.append(f"問題数: {len(result.issues)}")
        report_lines.append("")
        
        # 重要度別に問題を表示
        for severity in ValidationSeverity:
            issues = result.get_issues_by_severity(severity)
            if issues:
                report_lines.append(f"{severity.value.upper()} ({len(issues)}件):")
                for issue in issues:
                    report_lines.append(f"  - {issue.field_name}: {issue.message}")
                    if issue.suggestion:
                        report_lines.append(f"    提案: {issue.suggestion}")
                report_lines.append("")
        
        return "\n".join(report_lines)