"""
スキーマレジストリのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.schema_registry import (
    SchemaRegistry, DWHSchema, TableSchema, FieldDefinition, 
    DataType, ValidationRule
)


class TestSchemaRegistry:
    """スキーマレジストリのテストクラス"""
    
    @pytest.fixture
    def registry(self):
        """テスト用レジストリ"""
        return SchemaRegistry()
    
    @pytest.fixture
    def sample_field_def(self):
        """サンプルフィールド定義"""
        return FieldDefinition(
            name="test_field",
            data_type=DataType.STRING,
            nullable=True,
            max_length=255,
            description="テスト用フィールド"
        )
    
    def test_create_default_schema(self, registry):
        """デフォルトスキーマ作成のテスト"""
        schema = registry.create_default_schema()
        
        assert isinstance(schema, DWHSchema)
        assert schema.name == "ecommerce_dwh"
        assert schema.version == "1.0.0"
        assert len(schema.tables) == 3  # products, orders, customers
        
        # テーブルの存在確認
        assert "products" in schema.tables
        assert "orders" in schema.tables
        assert "customers" in schema.tables
    
    def test_register_schema(self, registry):
        """スキーマ登録のテスト"""
        schema = registry.create_default_schema()
        
        # スキーマ登録
        registry.register_schema(schema)
        
        # 取得確認
        retrieved = registry.get_schema("ecommerce_dwh", "1.0.0")
        assert retrieved == schema
        
        # 最新バージョン取得
        latest = registry.get_latest_schema("ecommerce_dwh")
        assert latest == schema
    
    def test_field_definition_creation(self):
        """フィールド定義作成のテスト"""
        field = FieldDefinition(
            name="price",
            data_type=DataType.DECIMAL,
            nullable=False,
            default_value=Decimal("0"),
            min_value=Decimal("0"),
            description="商品価格"
        )
        
        assert field.name == "price"
        assert field.data_type == DataType.DECIMAL
        assert field.nullable is False
        assert field.default_value == Decimal("0")
        assert field.min_value == Decimal("0")
    
    def test_table_schema_creation(self, sample_field_def):
        """テーブルスキーマ作成のテスト"""
        table = TableSchema(
            name="test_table",
            description="テスト用テーブル"
        )
        
        # フィールド追加
        table.add_field(sample_field_def)
        
        assert len(table.fields) == 1
        assert "test_field" in table.fields
        assert table.fields["test_field"] == sample_field_def
    
    def test_validation_rule_execution(self):
        """検証ルール実行のテスト"""
        # 正の数チェックルール
        rule = ValidationRule(
            name="positive_number",
            field_name="price",
            validator=lambda x: x > 0,
            error_message="価格は正の数である必要があります"
        )
        
        # 検証実行
        assert rule.validate(10) is True
        assert rule.validate(0) is False
        assert rule.validate(-5) is False
    
    def test_schema_version_comparison(self, registry):
        """スキーマバージョン比較のテスト"""
        # 異なるバージョンのスキーマを作成
        schema1 = DWHSchema(name="test", version="1.0.0")
        schema2 = DWHSchema(name="test", version="1.1.0")
        schema3 = DWHSchema(name="test", version="2.0.0")
        
        # 登録
        registry.register_schema(schema1)
        registry.register_schema(schema2)
        registry.register_schema(schema3)
        
        # 最新バージョン取得
        latest = registry.get_latest_schema("test")
        assert latest.version == "2.0.0"
    
    def test_get_table_schema(self, registry):
        """テーブルスキーマ取得のテスト"""
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        
        # productsテーブルのスキーマ取得
        products_table = registry.get_table_schema("ecommerce_dwh", "products")
        assert products_table is not None
        assert products_table.name == "products"
        assert "external_id" in products_table.fields
        assert "name" in products_table.fields
        assert "price" in products_table.fields
    
    def test_field_validation_rules(self, registry):
        """フィールド検証ルールのテスト"""
        schema = registry.create_default_schema()
        products_table = schema.tables["products"]
        
        # 価格フィールドの検証ルール
        price_field = products_table.fields["price"]
        assert price_field.min_value == Decimal("0")
        
        # 在庫数フィールドの検証ルール
        inventory_field = products_table.fields["inventory_quantity"]
        assert inventory_field.data_type == DataType.INTEGER
        assert inventory_field.min_value == 0
    
    def test_schema_serialization(self, registry):
        """スキーマのシリアライズ/デシリアライズのテスト"""
        original_schema = registry.create_default_schema()
        
        # 辞書に変換
        schema_dict = original_schema.to_dict()
        assert isinstance(schema_dict, dict)
        assert schema_dict["name"] == "ecommerce_dwh"
        assert "tables" in schema_dict
        
        # 辞書から復元
        restored_schema = DWHSchema.from_dict(schema_dict)
        assert restored_schema.name == original_schema.name
        assert restored_schema.version == original_schema.version
        assert len(restored_schema.tables) == len(original_schema.tables)
    
    def test_data_type_properties(self):
        """データ型プロパティのテスト"""
        # 文字列型
        assert DataType.STRING.is_text_type() is True
        assert DataType.STRING.is_numeric_type() is False
        assert DataType.STRING.is_date_type() is False
        
        # 数値型
        assert DataType.INTEGER.is_numeric_type() is True
        assert DataType.DECIMAL.is_numeric_type() is True
        
        # 日付型
        assert DataType.DATETIME.is_date_type() is True
        assert DataType.DATE.is_date_type() is True
    
    def test_schema_registry_error_handling(self, registry):
        """エラーハンドリングのテスト"""
        # 存在しないスキーマの取得
        with pytest.raises(ValueError):
            registry.get_schema("non_existent", "1.0.0")
        
        # 存在しないテーブルの取得
        with pytest.raises(ValueError):
            registry.get_table_schema("non_existent", "non_table")
    
    def test_custom_table_schema_creation(self):
        """カスタムテーブルスキーマ作成のテスト"""
        # カスタムテーブル作成
        custom_table = TableSchema(
            name="custom_table",
            description="カスタムテーブル",
            primary_key="custom_id"
        )
        
        # カスタムフィールド追加
        custom_table.add_field(FieldDefinition(
            name="custom_id",
            data_type=DataType.STRING,
            nullable=False,
            max_length=50
        ))
        
        custom_table.add_field(FieldDefinition(
            name="custom_data",
            data_type=DataType.JSON,
            nullable=True
        ))
        
        assert len(custom_table.fields) == 2
        assert custom_table.primary_key == "custom_id"