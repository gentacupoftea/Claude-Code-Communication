"""
タイプコンバーターのテスト
"""
import pytest
from datetime import datetime, date, timezone
from decimal import Decimal
from src.data_integration.mapping.utils.type_converter import (
    TypeConverter, ConversionError, DataType
)


class TestTypeConverter:
    @pytest.fixture
    def converter(self):
        return TypeConverter()
    
    def test_convert_to_string(self, converter):
        """文字列変換のテスト"""
        # 各種型から文字列への変換
        assert converter.convert(123, DataType.STRING) == "123"
        assert converter.convert(123.45, DataType.STRING) == "123.45"
        assert converter.convert(True, DataType.STRING) == "True"
        assert converter.convert(None, DataType.STRING) == ""
        assert converter.convert("already string", DataType.STRING) == "already string"
        
        # 日本語文字列
        assert converter.convert("テスト商品", DataType.STRING) == "テスト商品"
        
        # オブジェクト
        obj = {'key': 'value'}
        assert converter.convert(obj, DataType.STRING) == str(obj)
    
    def test_convert_to_integer(self, converter):
        """整数変換のテスト"""
        # 正常な変換
        assert converter.convert("123", DataType.INTEGER) == 123
        assert converter.convert(123.0, DataType.INTEGER) == 123
        assert converter.convert(123.7, DataType.INTEGER) == 123  # 切り捨て
        assert converter.convert(True, DataType.INTEGER) == 1
        assert converter.convert(False, DataType.INTEGER) == 0
        
        # Decimal
        assert converter.convert(Decimal("123.45"), DataType.INTEGER) == 123
        
        # 無効な変換
        with pytest.raises(ConversionError):
            converter.convert("abc", DataType.INTEGER)
        
        with pytest.raises(ConversionError):
            converter.convert("12.34.56", DataType.INTEGER)
        
        # None
        assert converter.convert(None, DataType.INTEGER) is None
    
    def test_convert_to_decimal(self, converter):
        """Decimal変換のテスト"""
        # 正常な変換
        assert converter.convert("123.45", DataType.DECIMAL) == Decimal("123.45")
        assert converter.convert(123.45, DataType.DECIMAL) == Decimal("123.45")
        assert converter.convert(123, DataType.DECIMAL) == Decimal("123")
        
        # カンマ区切り
        assert converter.convert("1,234.56", DataType.DECIMAL) == Decimal("1234.56")
        assert converter.convert("1,234,567.89", DataType.DECIMAL) == Decimal("1234567.89")
        
        # 日本円表記
        assert converter.convert("¥1,234", DataType.DECIMAL) == Decimal("1234")
        assert converter.convert("￥1,234.56", DataType.DECIMAL) == Decimal("1234.56")
        
        # 無効な変換
        with pytest.raises(ConversionError):
            converter.convert("not a number", DataType.DECIMAL)
        
        # None
        assert converter.convert(None, DataType.DECIMAL) is None
    
    def test_convert_to_boolean(self, converter):
        """ブール値変換のテスト"""
        # True変換
        assert converter.convert("true", DataType.BOOLEAN) is True
        assert converter.convert("True", DataType.BOOLEAN) is True
        assert converter.convert("TRUE", DataType.BOOLEAN) is True
        assert converter.convert("yes", DataType.BOOLEAN) is True
        assert converter.convert("1", DataType.BOOLEAN) is True
        assert converter.convert(1, DataType.BOOLEAN) is True
        assert converter.convert("on", DataType.BOOLEAN) is True
        
        # False変換
        assert converter.convert("false", DataType.BOOLEAN) is False
        assert converter.convert("False", DataType.BOOLEAN) is False
        assert converter.convert("FALSE", DataType.BOOLEAN) is False
        assert converter.convert("no", DataType.BOOLEAN) is False
        assert converter.convert("0", DataType.BOOLEAN) is False
        assert converter.convert(0, DataType.BOOLEAN) is False
        assert converter.convert("off", DataType.BOOLEAN) is False
        assert converter.convert("", DataType.BOOLEAN) is False
        
        # None
        assert converter.convert(None, DataType.BOOLEAN) is None
        
        # その他（デフォルトFalse）
        assert converter.convert("unknown", DataType.BOOLEAN) is False
    
    def test_convert_to_datetime(self, converter):
        """日時変換のテスト"""
        # ISO形式
        dt = converter.convert("2024-01-15T10:30:00Z", DataType.DATETIME)
        assert isinstance(dt, datetime)
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30
        
        # 日本時間
        dt = converter.convert("2024-01-15T19:30:00+09:00", DataType.DATETIME)
        assert isinstance(dt, datetime)
        
        # 日付のみ
        dt = converter.convert("2024-01-15", DataType.DATETIME)
        assert isinstance(dt, datetime)
        assert dt.hour == 0
        assert dt.minute == 0
        
        # 日本形式
        dt = converter.convert("2024年1月15日", DataType.DATETIME)
        assert isinstance(dt, datetime)
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        
        # タイムスタンプ
        dt = converter.convert(1705329600, DataType.DATETIME)  # 2024-01-15 12:00:00 UTC
        assert isinstance(dt, datetime)
        
        # 無効な形式
        with pytest.raises(ConversionError):
            converter.convert("invalid date", DataType.DATETIME)
        
        # None
        assert converter.convert(None, DataType.DATETIME) is None
    
    def test_convert_to_date(self, converter):
        """日付変換のテスト"""
        # 標準形式
        d = converter.convert("2024-01-15", DataType.DATE)
        assert isinstance(d, date)
        assert d.year == 2024
        assert d.month == 1
        assert d.day == 15
        
        # スラッシュ区切り
        d = converter.convert("2024/01/15", DataType.DATE)
        assert isinstance(d, date)
        
        # 日本形式
        d = converter.convert("2024年1月15日", DataType.DATE)
        assert isinstance(d, date)
        
        # datetime -> date
        dt = datetime(2024, 1, 15, 10, 30, 0)
        d = converter.convert(dt, DataType.DATE)
        assert isinstance(d, date)
        assert d.year == 2024
        assert d.month == 1
        assert d.day == 15
        
        # None
        assert converter.convert(None, DataType.DATE) is None
    
    def test_convert_list(self, converter):
        """リスト変換のテスト"""
        # 文字列のリスト
        data = ["100", "200", "300"]
        result = converter.convert_list(data, DataType.INTEGER)
        assert result == [100, 200, 300]
        
        # 混在型のリスト
        data = ["100", None, "300", "invalid"]
        result = converter.convert_list(data, DataType.INTEGER, skip_errors=True)
        assert result == [100, None, 300]  # invalidはスキップ
        
        # エラーを伝播
        with pytest.raises(ConversionError):
            converter.convert_list(["100", "invalid"], DataType.INTEGER, skip_errors=False)
    
    def test_convert_dict(self, converter):
        """辞書変換のテスト"""
        # 型定義
        type_map = {
            'id': DataType.INTEGER,
            'name': DataType.STRING,
            'price': DataType.DECIMAL,
            'is_active': DataType.BOOLEAN,
            'created_at': DataType.DATETIME
        }
        
        # 入力データ
        data = {
            'id': "123",
            'name': "テスト商品",
            'price': "1,234.56",
            'is_active': "true",
            'created_at': "2024-01-15T10:00:00Z",
            'unknown_field': "value"  # 型定義にないフィールド
        }
        
        result = converter.convert_dict(data, type_map)
        
        assert result['id'] == 123
        assert result['name'] == "テスト商品"
        assert result['price'] == Decimal("1234.56")
        assert result['is_active'] is True
        assert isinstance(result['created_at'], datetime)
        assert result['unknown_field'] == "value"  # そのまま保持
    
    def test_auto_detect_type(self, converter):
        """型自動検出のテスト"""
        # 整数
        assert converter.auto_detect_type("123") == DataType.INTEGER
        assert converter.auto_detect_type("0") == DataType.INTEGER
        assert converter.auto_detect_type("-456") == DataType.INTEGER
        
        # 小数
        assert converter.auto_detect_type("123.45") == DataType.DECIMAL
        assert converter.auto_detect_type("0.5") == DataType.DECIMAL
        assert converter.auto_detect_type("-123.45") == DataType.DECIMAL
        
        # ブール値
        assert converter.auto_detect_type("true") == DataType.BOOLEAN
        assert converter.auto_detect_type("false") == DataType.BOOLEAN
        assert converter.auto_detect_type("True") == DataType.BOOLEAN
        
        # 日付
        assert converter.auto_detect_type("2024-01-15") == DataType.DATE
        assert converter.auto_detect_type("2024/01/15") == DataType.DATE
        
        # 日時
        assert converter.auto_detect_type("2024-01-15T10:00:00") == DataType.DATETIME
        assert converter.auto_detect_type("2024-01-15 10:00:00") == DataType.DATETIME
        
        # デフォルト（文字列）
        assert converter.auto_detect_type("just text") == DataType.STRING
        assert converter.auto_detect_type("") == DataType.STRING
    
    def test_custom_converter(self, converter):
        """カスタムコンバーターのテスト"""
        # カスタム変換関数を登録
        def convert_to_upper(value):
            return str(value).upper()
        
        converter.register_custom_converter("UPPER", convert_to_upper)
        
        # カスタム変換を使用
        result = converter.convert("hello", "UPPER")
        assert result == "HELLO"
        
        result = converter.convert("テスト123", "UPPER")
        assert result == "テスト123"