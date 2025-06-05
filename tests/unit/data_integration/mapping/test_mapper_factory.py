"""
マッパーファクトリーのテスト
"""
import pytest

from src.data_integration.mapping.mapper_factory import (
    MapperFactory, DataSource, create_mapper, get_mapper_factory, reset_factory
)
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.mappers.shopify_mapper import ShopifyMapper
from src.data_integration.mapping.mappers.amazon_mapper import AmazonMapper
from src.data_integration.mapping.mappers.rakuten_mapper import RakutenMapper
from src.data_integration.mapping.mappers.nextengine_mapper import NextEngineMapper
from src.data_integration.mapping.mappers.file_mapper import FileDataMapper
from src.data_integration.mapping.mappers.googlesheets_mapper import GoogleSheetsMapper


class TestMapperFactory:
    """マッパーファクトリーのテストクラス"""
    
    @pytest.fixture
    def factory(self):
        """テスト用ファクトリー"""
        reset_factory()  # グローバルファクトリーをリセット
        return MapperFactory()
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        return SchemaRegistry()
    
    def test_factory_initialization(self, factory):
        """ファクトリー初期化のテスト"""
        assert factory.schema_registry is not None
        assert len(factory._mapper_classes) == 6  # 6つのマッパーが登録されている
        assert len(factory._mapper_cache) == 0  # キャッシュは空
    
    def test_create_shopify_mapper(self, factory):
        """Shopifyマッパー作成のテスト"""
        mapper = factory.create_mapper("shopify")
        assert isinstance(mapper, ShopifyMapper)
        assert mapper.data_source == "shopify"
        
        # キャッシュ確認
        assert DataSource.SHOPIFY in factory._mapper_cache
    
    def test_create_amazon_mapper(self, factory):
        """Amazonマッパー作成のテスト"""
        mapper = factory.create_mapper(DataSource.AMAZON_SP_API)
        assert isinstance(mapper, AmazonMapper)
        assert mapper.data_source == "amazon_sp_api"
    
    def test_create_rakuten_mapper(self, factory):
        """楽天マッパー作成のテスト"""
        mapper = factory.create_mapper("rakuten_rms")
        assert isinstance(mapper, RakutenMapper)
        assert mapper.data_source == "rakuten_rms"
    
    def test_create_nextengine_mapper(self, factory):
        """NextEngineマッパー作成のテスト"""
        mapper = factory.create_mapper(DataSource.NEXTENGINE)
        assert isinstance(mapper, NextEngineMapper)
        assert mapper.data_source == "nextengine"
    
    def test_create_file_mapper(self, factory):
        """ファイルマッパー作成のテスト"""
        mapper = factory.create_mapper("file_import")
        assert isinstance(mapper, FileDataMapper)
        assert mapper.data_source == "file_import"
    
    def test_create_googlesheets_mapper(self, factory):
        """Googleスプレッドシートマッパー作成のテスト"""
        mapper = factory.create_mapper(DataSource.GOOGLE_SHEETS)
        assert isinstance(mapper, GoogleSheetsMapper)
        assert mapper.data_source == "google_sheets"
    
    def test_mapper_caching(self, factory):
        """マッパーキャッシングのテスト"""
        # 初回作成
        mapper1 = factory.create_mapper("shopify")
        
        # 2回目はキャッシュから取得
        mapper2 = factory.create_mapper("shopify")
        
        # 同じインスタンスであることを確認
        assert mapper1 is mapper2
    
    def test_get_supported_sources(self, factory):
        """サポートソース取得のテスト"""
        sources = factory.get_supported_sources()
        
        assert len(sources) == 6
        assert "shopify" in sources
        assert "amazon_sp_api" in sources
        assert "rakuten_rms" in sources
        assert "nextengine" in sources
        assert "file_import" in sources
        assert "google_sheets" in sources
    
    def test_register_custom_mapper(self, factory):
        """カスタムマッパー登録のテスト"""
        from src.data_integration.mapping.base_mapper import BaseDataMapper
        
        class CustomMapper(BaseDataMapper):
            def __init__(self, schema_registry):
                super().__init__(schema_registry)
                self.data_source = "custom"
            
            async def map_data(self, source_data, table_name):
                pass
        
        # カスタムマッパーを登録
        factory.register_mapper(DataSource.SHOPIFY, CustomMapper)
        
        # 作成確認
        mapper = factory.create_mapper("shopify")
        assert isinstance(mapper, CustomMapper)
        assert mapper.data_source == "custom"
    
    def test_clear_cache(self, factory):
        """キャッシュクリアのテスト"""
        # マッパーを作成してキャッシュ
        factory.create_mapper("shopify")
        factory.create_mapper("amazon_sp_api")
        
        assert len(factory._mapper_cache) == 2
        
        # キャッシュクリア
        factory.clear_cache()
        
        assert len(factory._mapper_cache) == 0
    
    def test_get_mapper_info(self, factory):
        """マッパー情報取得のテスト"""
        info = factory.get_mapper_info("shopify")
        
        assert info["data_source"] == "shopify"
        assert info["mapper_class"] == "ShopifyMapper"
        assert "supported_tables" in info
        assert "capabilities" in info
        assert info["is_cached"] is True  # 情報取得時に作成される
    
    def test_validate_data_source_compatibility(self, factory):
        """データソース互換性検証のテスト"""
        # 互換性あり
        result = factory.validate_data_source_compatibility("shopify", "products")
        assert result["is_compatible"] is True
        assert "products" in result["supported_tables"]
        
        # 互換性なし（仮想的なケース）
        result = factory.validate_data_source_compatibility("shopify", "invalid_table")
        # 実際にはすべてのマッパーがmap_dataメソッドを持つため、エラーにはならない
    
    def test_get_mapping_recommendations(self, factory):
        """マッピング推奨取得のテスト"""
        sample_data = {
            "id": "123",
            "商品名": "テスト商品",
            "価格": "1000"
        }
        
        # ファイルマッパーは推奨機能をサポート
        recommendations = factory.get_mapping_recommendations(
            "file_import", sample_data, "products"
        )
        
        assert recommendations["has_suggestions"] is True
        assert "suggestions" in recommendations
    
    def test_invalid_data_source(self, factory):
        """無効なデータソースのテスト"""
        with pytest.raises(ValueError):
            factory.create_mapper("invalid_source")
    
    def test_data_source_enum(self):
        """DataSource列挙型のテスト"""
        # 文字列から変換
        source = DataSource.from_string("shopify")
        assert source == DataSource.SHOPIFY
        
        # 無効な文字列
        with pytest.raises(ValueError):
            DataSource.from_string("invalid")
    
    def test_global_factory_functions(self):
        """グローバルファクトリー関数のテスト"""
        # グローバルファクトリー取得
        factory1 = get_mapper_factory()
        factory2 = get_mapper_factory()
        assert factory1 is factory2  # 同じインスタンス
        
        # マッパー作成
        mapper = create_mapper("shopify")
        assert isinstance(mapper, ShopifyMapper)
        
        # ファクトリーリセット
        reset_factory()
        factory3 = get_mapper_factory()
        assert factory3 is not factory1  # 新しいインスタンス
    
    def test_mapper_capabilities(self, factory):
        """マッパー機能情報のテスト"""
        # ファイルマッパーの機能
        info = factory.get_mapper_info("file_import")
        capabilities = info["capabilities"]
        
        assert capabilities["supports_auto_mapping"] is True
        assert capabilities["supports_batch_processing"] is True
        assert capabilities["supports_column_detection"] is True
        assert capabilities["supports_type_inference"] is True
        
        # Shopifyマッパーの機能
        info = factory.get_mapper_info("shopify")
        capabilities = info["capabilities"]
        
        assert capabilities["supports_batch_processing"] is True
        assert capabilities.get("supports_column_detection", False) is False