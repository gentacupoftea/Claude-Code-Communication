"""
タイプコンバーター
データ型変換機能を提供
"""
import logging
import re
from typing import Any, Optional, Union, Type, Dict, List
from datetime import datetime, timezone, date
from decimal import Decimal, InvalidOperation
from enum import Enum

logger = logging.getLogger(__name__)


class ConversionError(Exception):
    """型変換エラー"""
    pass


class DataType(Enum):
    """サポートされるデータ型"""
    STRING = "string"
    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    LIST = "list"
    JSON = "json"


class TypeConverter:
    """型変換クラス"""
    
    def __init__(self):
        self.conversion_cache: Dict[str, Any] = {}
        self._load_conversion_mappings()
    
    def _load_conversion_mappings(self):
        """変換マッピングを初期化"""
        # ブール値のマッピング
        self.boolean_mappings = {
            # 英語
            "true": True, "false": False,
            "yes": True, "no": False,
            "y": True, "n": False,
            "on": True, "off": False,
            "1": True, "0": False,
            "enabled": True, "disabled": False,
            "active": True, "inactive": False,
            # 日本語
            "はい": True, "いいえ": False,
            "有効": True, "無効": False,
            "オン": True, "オフ": False,
            # 記号
            "○": True, "×": False, "✓": True
        }
        
        # 日付フォーマットパターン
        self.date_patterns = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%Y年%m月%d日 %H:%M:%S",
            "%Y年%m月%d日 %H:%M",
            "%Y年%m月%d日",
            "%m月%d日 %H:%M",
            "%m月%d日"
        ]

    def convert(self, value: Any, target_type: Union[DataType, str], 
                strict: bool = False) -> Any:
        """
        値を指定された型に変換
        
        Args:
            value: 変換する値
            target_type: 変換先の型
            strict: 厳密モード（変換エラー時に例外を発生）
            
        Returns:
            変換された値
            
        Raises:
            ConversionError: 変換に失敗した場合（strict=Trueの場合）
        """
        try:
            if isinstance(target_type, str):
                target_type = DataType(target_type.lower())
            
            # null値の処理
            if value is None or value == "":
                return None
            
            # 既に正しい型の場合はそのまま返す
            if self._is_correct_type(value, target_type):
                return value
            
            # 型に応じた変換
            if target_type == DataType.STRING:
                return self._to_string(value)
            elif target_type == DataType.INTEGER:
                return self._to_integer(value)
            elif target_type == DataType.DECIMAL:
                return self._to_decimal(value)
            elif target_type == DataType.BOOLEAN:
                return self._to_boolean(value)
            elif target_type == DataType.DATETIME:
                return self._to_datetime(value)
            elif target_type == DataType.DATE:
                return self._to_date(value)
            elif target_type == DataType.LIST:
                return self._to_list(value)
            elif target_type == DataType.JSON:
                return self._to_json(value)
            else:
                raise ConversionError(f"サポートされていない型: {target_type}")
                
        except Exception as e:
            if strict:
                raise ConversionError(f"型変換エラー: {value} -> {target_type}, {str(e)}")
            else:
                logger.warning(f"型変換に失敗、デフォルト値を使用: {value} -> {target_type}, {str(e)}")
                return self._get_default_value(target_type)

    def _is_correct_type(self, value: Any, target_type: DataType) -> bool:
        """値が既に正しい型かチェック"""
        if target_type == DataType.STRING:
            return isinstance(value, str)
        elif target_type == DataType.INTEGER:
            return isinstance(value, int) and not isinstance(value, bool)
        elif target_type == DataType.DECIMAL:
            return isinstance(value, (Decimal, float, int)) and not isinstance(value, bool)
        elif target_type == DataType.BOOLEAN:
            return isinstance(value, bool)
        elif target_type == DataType.DATETIME:
            return isinstance(value, datetime)
        elif target_type == DataType.DATE:
            return isinstance(value, date)
        elif target_type == DataType.LIST:
            return isinstance(value, list)
        elif target_type == DataType.JSON:
            return isinstance(value, (dict, list))
        return False

    def _to_string(self, value: Any) -> str:
        """文字列に変換"""
        if isinstance(value, str):
            return value.strip()
        elif isinstance(value, (list, dict)):
            import json
            return json.dumps(value, ensure_ascii=False)
        else:
            return str(value)

    def _to_integer(self, value: Any) -> int:
        """整数に変換"""
        if isinstance(value, bool):
            return int(value)
        elif isinstance(value, int):
            return value
        elif isinstance(value, float):
            return int(value)
        elif isinstance(value, Decimal):
            return int(value)
        elif isinstance(value, str):
            # 文字列の前処理
            cleaned = self._clean_numeric_string(value)
            if not cleaned:
                raise ConversionError("空の数値文字列")
            return int(float(cleaned))  # floatを経由して小数点を処理
        else:
            return int(value)

    def _to_decimal(self, value: Any) -> Decimal:
        """Decimalに変換"""
        if isinstance(value, Decimal):
            return value
        elif isinstance(value, bool):
            return Decimal(int(value))
        elif isinstance(value, (int, float)):
            return Decimal(str(value))
        elif isinstance(value, str):
            cleaned = self._clean_numeric_string(value)
            if not cleaned:
                raise ConversionError("空の数値文字列")
            return Decimal(cleaned)
        else:
            return Decimal(str(value))

    def _to_boolean(self, value: Any) -> bool:
        """ブール値に変換"""
        if isinstance(value, bool):
            return value
        elif isinstance(value, (int, float)):
            return value != 0
        elif isinstance(value, str):
            cleaned = value.strip().lower()
            if cleaned in self.boolean_mappings:
                return self.boolean_mappings[cleaned]
            else:
                # 数値として評価を試行
                try:
                    num_value = float(cleaned)
                    return num_value != 0
                except ValueError:
                    raise ConversionError(f"ブール値に変換できません: {value}")
        else:
            return bool(value)

    def _to_datetime(self, value: Any) -> datetime:
        """datetimeに変換"""
        if isinstance(value, datetime):
            return value
        elif isinstance(value, date):
            return datetime.combine(value, datetime.min.time()).replace(tzinfo=timezone.utc)
        elif isinstance(value, str):
            return self._parse_datetime_string(value)
        elif isinstance(value, (int, float)):
            # Unixタイムスタンプとして処理
            return datetime.fromtimestamp(value, tz=timezone.utc)
        else:
            raise ConversionError(f"datetimeに変換できません: {value}")

    def _to_date(self, value: Any) -> date:
        """dateに変換"""
        if isinstance(value, date):
            return value
        elif isinstance(value, datetime):
            return value.date()
        elif isinstance(value, str):
            dt = self._parse_datetime_string(value)
            return dt.date()
        else:
            raise ConversionError(f"dateに変換できません: {value}")

    def _to_list(self, value: Any) -> List[Any]:
        """リストに変換"""
        if isinstance(value, list):
            return value
        elif isinstance(value, str):
            # JSON形式の場合
            if value.strip().startswith('['):
                import json
                return json.loads(value)
            # カンマ区切りの場合
            elif ',' in value:
                return [item.strip() for item in value.split(',') if item.strip()]
            # セミコロン区切りの場合
            elif ';' in value:
                return [item.strip() for item in value.split(';') if item.strip()]
            # 単一値の場合
            else:
                return [value.strip()] if value.strip() else []
        elif isinstance(value, tuple):
            return list(value)
        else:
            return [value]

    def _to_json(self, value: Any) -> Union[Dict, List]:
        """JSONオブジェクトに変換"""
        if isinstance(value, (dict, list)):
            return value
        elif isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                raise ConversionError(f"JSONに変換できません: {value}")
        else:
            raise ConversionError(f"JSONに変換できません: {value}")

    def _clean_numeric_string(self, value: str) -> str:
        """数値文字列をクリーニング"""
        # 前後の空白を除去
        cleaned = value.strip()
        
        # 通貨記号やカンマを除去
        cleaned = re.sub(r'[¥$€£,]', '', cleaned)
        
        # 全角数字を半角に変換
        cleaned = cleaned.translate(str.maketrans('０１２３４５６７８９', '0123456789'))
        
        # 日本語の数値表記を処理
        cleaned = re.sub(r'[万億兆]', '', cleaned)
        
        return cleaned

    def _parse_datetime_string(self, date_str: str) -> datetime:
        """日付文字列をパース"""
        date_str = date_str.strip()
        
        # ISO形式の特別処理
        if 'T' in date_str:
            try:
                if date_str.endswith('Z'):
                    date_str = date_str[:-1] + '+00:00'
                return datetime.fromisoformat(date_str)
            except ValueError:
                pass
        
        # パターンマッチング
        for pattern in self.date_patterns:
            try:
                dt = datetime.strptime(date_str, pattern)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        
        raise ConversionError(f"日付形式を認識できません: {date_str}")

    def _get_default_value(self, data_type: DataType) -> Any:
        """型のデフォルト値を取得"""
        defaults = {
            DataType.STRING: "",
            DataType.INTEGER: 0,
            DataType.DECIMAL: Decimal('0'),
            DataType.BOOLEAN: False,
            DataType.DATETIME: None,
            DataType.DATE: None,
            DataType.LIST: [],
            DataType.JSON: {}
        }
        return defaults.get(data_type)

    def detect_type(self, value: Any) -> DataType:
        """値からデータ型を推定"""
        if value is None or value == "":
            return DataType.STRING
        
        if isinstance(value, bool):
            return DataType.BOOLEAN
        elif isinstance(value, int):
            return DataType.INTEGER
        elif isinstance(value, float):
            return DataType.DECIMAL
        elif isinstance(value, Decimal):
            return DataType.DECIMAL
        elif isinstance(value, datetime):
            return DataType.DATETIME
        elif isinstance(value, date):
            return DataType.DATE
        elif isinstance(value, list):
            return DataType.LIST
        elif isinstance(value, dict):
            return DataType.JSON
        elif isinstance(value, str):
            return self._detect_string_type(value)
        else:
            return DataType.STRING

    def _detect_string_type(self, value: str) -> DataType:
        """文字列の具体的な型を推定"""
        value = value.strip()
        
        # ブール値チェック
        if value.lower() in self.boolean_mappings:
            return DataType.BOOLEAN
        
        # 数値チェック
        cleaned_numeric = self._clean_numeric_string(value)
        if cleaned_numeric:
            try:
                if '.' in cleaned_numeric:
                    float(cleaned_numeric)
                    return DataType.DECIMAL
                else:
                    int(cleaned_numeric)
                    return DataType.INTEGER
            except ValueError:
                pass
        
        # 日付チェック
        try:
            self._parse_datetime_string(value)
            return DataType.DATETIME
        except ConversionError:
            pass
        
        # JSONチェック
        if value.startswith(('{', '[')):
            try:
                import json
                json.loads(value)
                return DataType.JSON
            except json.JSONDecodeError:
                pass
        
        # リストチェック（カンマ区切り）
        if ',' in value and len(value.split(',')) > 1:
            return DataType.LIST
        
        return DataType.STRING

    def batch_convert(self, data: List[Dict[str, Any]], 
                     type_mapping: Dict[str, DataType],
                     strict: bool = False) -> List[Dict[str, Any]]:
        """バッチで型変換を実行"""
        converted_data = []
        
        for record in data:
            converted_record = {}
            for field_name, value in record.items():
                if field_name in type_mapping:
                    converted_record[field_name] = self.convert(
                        value, type_mapping[field_name], strict
                    )
                else:
                    converted_record[field_name] = value
            converted_data.append(converted_record)
        
        return converted_data