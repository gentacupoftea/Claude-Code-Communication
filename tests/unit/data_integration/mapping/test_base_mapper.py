"""
ベースマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.base_mapper import (
    BaseDataMapper, MappingResult, MappingError, MappingConfig
)
from src.data_integration.mapping.schema_registry import SchemaRegistry


class TestDataMapper(BaseDataMapper):
    """テスト用の具体的なマッパー実装"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "test_source"
    
    async def map_data(self, source_data, table_name):
        """テスト用のマッピング実装"""
        result = MappingResult(
            mapped_data=[],
            errors=[],
            total_records=len(source_data),
            successful_records=0
        )
        
        for record in source_data:
            try:
                mapped = {"test_field": record.get("source_field")}
                result.mapped_data.append(mapped)
                result.successful_records += 1
            except Exception as e:
                result.errors.append(MappingError(
                    field="source_field",
                    value=str(record),
                    error_type="test_error",
                    message=str(e)
                ))
        
        return result


class TestBaseDataMapper:
    """ベースマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用マッパー"""
        return TestDataMapper(schema_registry)
    
    def test_mapper_initialization(self, mapper, schema_registry):
        """マッパー初期化のテスト"""
        assert mapper.schema_registry == schema_registry
        assert mapper.data_source == "test_source"
        assert mapper.config is not None
        assert isinstance(mapper.config, MappingConfig)
    
    def test_apply_field_mapping(self, mapper):
        """フィールドマッピング適用のテスト"""
        source_data = {
            "field1": "value1",
            "field2": "value2",
            "field3": "value3"
        }
        
        mapping = {
            "field1": "mapped_field1",
            "field2": "mapped_field2"
        }
        
        result = mapper._apply_field_mapping(source_data, mapping)
        
        assert result["mapped_field1"] == "value1"
        assert result["mapped_field2"] == "value2"
        assert "field3" not in result  # マッピングされていないフィールドは含まれない
    
    def test_convert_data_types(self, mapper):
        """データ型変換のテスト"""
        data = {
            "string_field": "test",
            "int_field": "123",
            "decimal_field": "99.99",
            "bool_field": "true",
            "date_field": "2023-01-15"
        }
        
        type_definitions = {
            "string_field": {"type": "string"},
            "int_field": {"type": "integer"},
            "decimal_field": {"type": "decimal"},
            "bool_field": {"type": "boolean"},
            "date_field": {"type": "date"}
        }
        
        result = mapper._convert_data_types(data, type_definitions)
        
        assert isinstance(result["string_field"], str)
        assert isinstance(result["int_field"], int)
        assert isinstance(result["decimal_field"], Decimal)
        assert isinstance(result["bool_field"], bool)
        assert result["date_field"] is not None  # 日付パース結果
    
    def test_validate_required_fields(self, mapper):
        """必須フィールド検証のテスト"""
        data = {
            "field1": "value1",
            "field2": None,
            "field3": ""
        }
        
        field_definitions = {
            "field1": {"required": True},
            "field2": {"required": True},
            "field3": {"required": False},
            "field4": {"required": True}  # データに存在しない
        }
        
        errors = mapper._validate_required_fields(data, field_definitions, "test_table")
        
        assert len(errors) == 2  # field2 (null) と field4 (missing)
        assert any(e.field == "field2" for e in errors)
        assert any(e.field == "field4" for e in errors)
    
    def test_validate_field_constraints(self, mapper):
        """フィールド制約検証のテスト"""
        data = {
            "price": Decimal("-10"),  # 負の値
            "name": "x" * 300,  # 長すぎる
            "status": "invalid",  # 無効な選択肢
            "email": "invalid-email"  # 無効な形式
        }
        
        field_definitions = {
            "price": {"type": "decimal", "min_value": 0},
            "name": {"type": "string", "max_length": 255},
            "status": {"type": "string", "choices": ["active", "inactive"]},
            "email": {"type": "string", "pattern": r"^[^@]+@[^@]+\.[^@]+$"}
        }
        
        errors = mapper._validate_field_constraints(data, field_definitions, "test_table")
        
        assert len(errors) == 4
        assert any(e.field == "price" and "min_value" in e.message for e in errors)
        assert any(e.field == "name" and "max_length" in e.message for e in errors)
        assert any(e.field == "status" and "choices" in e.message for e in errors)
        assert any(e.field == "email" and "pattern" in e.message for e in errors)
    
    @pytest.mark.asyncio
    async def test_map_data_async(self, mapper):
        """非同期マッピングのテスト"""
        source_data = [
            {"source_field": "value1"},
            {"source_field": "value2"},
            {"source_field": "value3"}
        ]
        
        result = await mapper.map_data(source_data, "test_table")
        
        assert isinstance(result, MappingResult)
        assert result.total_records == 3
        assert result.successful_records == 3
        assert len(result.mapped_data) == 3
        assert len(result.errors) == 0
    
    def test_mapping_result_properties(self):
        """MappingResult プロパティのテスト"""
        result = MappingResult(
            mapped_data=[{"id": 1}, {"id": 2}],
            errors=[MappingError("field1", "value", "error", "message")],
            total_records=3,
            successful_records=2
        )
        
        assert result.success_rate == 2/3
        assert result.error_rate == 1/3
        assert result.has_errors is True
        assert result.is_complete is False
    
    def test_mapping_error_creation(self):
        """MappingError 作成のテスト"""
        error = MappingError(
            field="test_field",
            value="test_value",
            error_type="validation_error",
            message="テストエラーメッセージ"
        )
        
        assert error.field == "test_field"
        assert error.value == "test_value"
        assert error.error_type == "validation_error"
        assert error.message == "テストエラーメッセージ"
    
    def test_mapping_config(self, mapper):
        """MappingConfig のテスト"""
        # デフォルト設定確認
        assert mapper.config.batch_size == 1000
        assert mapper.config.validate_data is True
        assert mapper.config.convert_types is True
        assert mapper.config.skip_invalid_records is False
        
        # 設定変更
        mapper.config.batch_size = 500
        mapper.config.skip_invalid_records = True
        
        assert mapper.config.batch_size == 500
        assert mapper.config.skip_invalid_records is True
    
    def test_handle_mapping_error(self, mapper):
        """エラーハンドリングのテスト"""
        # スキップモード
        mapper.config.skip_invalid_records = True
        errors = []
        
        # エラーが発生してもスキップ
        mapper._handle_mapping_error(
            Exception("テストエラー"),
            {"id": 1},
            errors,
            0
        )
        
        assert len(errors) == 1
        assert errors[0].message == "テストエラー"
        
        # 非スキップモード
        mapper.config.skip_invalid_records = False
        with pytest.raises(Exception):
            mapper._handle_mapping_error(
                Exception("テストエラー"),
                {"id": 2},
                [],
                1
            )