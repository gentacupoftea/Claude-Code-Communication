"""
マッパーファクトリー
データソースに応じた適切なマッパーを生成する
"""
import logging
from typing import Dict, Type, Optional, Union
from enum import Enum

from .base_mapper import BaseDataMapper
from .schema_registry import SchemaRegistry
from .mappers.shopify_mapper import ShopifyMapper
from .mappers.amazon_mapper import AmazonMapper  
from .mappers.rakuten_mapper import RakutenMapper
from .mappers.nextengine_mapper import NextEngineMapper
from .mappers.file_mapper import FileDataMapper
from .mappers.googlesheets_mapper import GoogleSheetsMapper

logger = logging.getLogger(__name__)


class DataSource(Enum):
    """サポートされているデータソース"""
    SHOPIFY = "shopify"
    AMAZON_SP_API = "amazon_sp_api"
    RAKUTEN_RMS = "rakuten_rms"
    NEXTENGINE = "nextengine"
    FILE_IMPORT = "file_import"
    GOOGLE_SHEETS = "google_sheets"
    
    @classmethod
    def from_string(cls, value: str) -> 'DataSource':
        """文字列からDataSourceを生成"""
        for source in cls:
            if source.value == value.lower():
                return source
        raise ValueError(f"サポートされていないデータソース: {value}")


class MapperFactory:
    """マッパーファクトリークラス"""
    
    def __init__(self, schema_registry: Optional[SchemaRegistry] = None):
        """
        ファクトリーの初期化
        
        Args:
            schema_registry: スキーマレジストリインスタンス
        """
        self.schema_registry = schema_registry or SchemaRegistry()
        
        # マッパークラスの登録
        self._mapper_classes: Dict[DataSource, Type[BaseDataMapper]] = {
            DataSource.SHOPIFY: ShopifyMapper,
            DataSource.AMAZON_SP_API: AmazonMapper,
            DataSource.RAKUTEN_RMS: RakutenMapper,
            DataSource.NEXTENGINE: NextEngineMapper,
            DataSource.FILE_IMPORT: FileDataMapper,
            DataSource.GOOGLE_SHEETS: GoogleSheetsMapper
        }
        
        # マッパーインスタンスのキャッシュ
        self._mapper_cache: Dict[DataSource, BaseDataMapper] = {}
        
        logger.info(f"マッパーファクトリー初期化完了: {len(self._mapper_classes)}個のマッパーを登録")

    def create_mapper(self, data_source: Union[str, DataSource]) -> BaseDataMapper:
        """
        データソースに応じたマッパーを作成
        
        Args:
            data_source: データソース識別子
            
        Returns:
            適切なマッパーインスタンス
            
        Raises:
            ValueError: サポートされていないデータソースの場合
        """
        try:
            # DataSourceに変換
            if isinstance(data_source, str):
                source_enum = DataSource.from_string(data_source)
            else:
                source_enum = data_source
            
            # キャッシュから取得を試行
            if source_enum in self._mapper_cache:
                logger.debug(f"キャッシュからマッパーを取得: {source_enum.value}")
                return self._mapper_cache[source_enum]
            
            # マッパークラスを取得
            mapper_class = self._mapper_classes.get(source_enum)
            if not mapper_class:
                raise ValueError(f"マッパークラスが見つかりません: {source_enum.value}")
            
            # マッパーインスタンスを作成
            mapper_instance = mapper_class(self.schema_registry)
            
            # キャッシュに保存
            self._mapper_cache[source_enum] = mapper_instance
            
            logger.info(f"マッパーを作成: {source_enum.value} -> {mapper_class.__name__}")
            return mapper_instance
            
        except Exception as e:
            logger.error(f"マッパー作成エラー: {e}")
            raise

    def get_supported_sources(self) -> List[str]:
        """サポートされているデータソースのリストを取得"""
        return [source.value for source in DataSource]

    def register_mapper(self, data_source: DataSource, mapper_class: Type[BaseDataMapper]):
        """
        新しいマッパークラスを登録
        
        Args:
            data_source: データソース
            mapper_class: マッパークラス
        """
        self._mapper_classes[data_source] = mapper_class
        
        # キャッシュをクリア
        if data_source in self._mapper_cache:
            del self._mapper_cache[data_source]
        
        logger.info(f"マッパーを登録: {data_source.value} -> {mapper_class.__name__}")

    def clear_cache(self):
        """マッパーキャッシュをクリア"""
        self._mapper_cache.clear()
        logger.info("マッパーキャッシュをクリアしました")

    def get_mapper_info(self, data_source: Union[str, DataSource]) -> Dict[str, any]:
        """
        マッパーの情報を取得
        
        Args:
            data_source: データソース識別子
            
        Returns:
            マッパー情報
        """
        try:
            if isinstance(data_source, str):
                source_enum = DataSource.from_string(data_source)
            else:
                source_enum = data_source
            
            mapper_class = self._mapper_classes.get(source_enum)
            if not mapper_class:
                return {"error": f"マッパーが見つかりません: {source_enum.value}"}
            
            # マッパーインスタンスを作成（キャッシュから取得または新規作成）
            mapper = self.create_mapper(source_enum)
            
            return {
                "data_source": source_enum.value,
                "mapper_class": mapper_class.__name__,
                "is_cached": source_enum in self._mapper_cache,
                "supported_tables": self._get_supported_tables(mapper),
                "capabilities": self._get_mapper_capabilities(mapper)
            }
            
        except Exception as e:
            logger.error(f"マッパー情報取得エラー: {e}")
            return {"error": str(e)}

    def _get_supported_tables(self, mapper: BaseDataMapper) -> List[str]:
        """マッパーがサポートするテーブルを取得"""
        supported_tables = []
        
        # マッパーのメソッドから推定
        if hasattr(mapper, 'map_products'):
            supported_tables.append("products")
        if hasattr(mapper, 'map_orders'):
            supported_tables.append("orders")
        if hasattr(mapper, 'map_customers'):
            supported_tables.append("customers")
        
        return supported_tables

    def _get_mapper_capabilities(self, mapper: BaseDataMapper) -> Dict[str, bool]:
        """マッパーの機能を取得"""
        capabilities = {
            "supports_auto_mapping": hasattr(mapper, 'get_suggested_mappings'),
            "supports_batch_processing": True,  # 全マッパーがサポート
            "supports_validation": hasattr(mapper, 'validate_data'),
            "supports_preview": hasattr(mapper, 'preview_mapping'),
            "supports_custom_fields": True  # 基本的に全マッパーがサポート
        }
        
        # ファイル/スプレッドシート特有の機能
        if isinstance(mapper, (FileDataMapper, GoogleSheetsMapper)):
            capabilities.update({
                "supports_column_detection": True,
                "supports_type_inference": True,
                "supports_template_creation": True
            })
        
        return capabilities

    def validate_data_source_compatibility(self, data_source: Union[str, DataSource], 
                                         table_name: str) -> Dict[str, any]:
        """
        データソースとテーブルの互換性を検証
        
        Args:
            data_source: データソース識別子
            table_name: テーブル名
            
        Returns:
            互換性情報
        """
        try:
            mapper = self.create_mapper(data_source)
            supported_tables = self._get_supported_tables(mapper)
            
            is_compatible = table_name in supported_tables
            
            return {
                "is_compatible": is_compatible,
                "data_source": data_source,
                "table_name": table_name,
                "supported_tables": supported_tables,
                "message": "互換性があります" if is_compatible else f"テーブル '{table_name}' はサポートされていません"
            }
            
        except Exception as e:
            logger.error(f"互換性チェックエラー: {e}")
            return {
                "is_compatible": False,
                "error": str(e)
            }

    def get_mapping_recommendations(self, data_source: Union[str, DataSource],
                                  sample_data: Dict[str, any],
                                  table_name: str) -> Dict[str, any]:
        """
        マッピング推奨事項を取得
        
        Args:
            data_source: データソース識別子
            sample_data: サンプルデータ
            table_name: テーブル名
            
        Returns:
            マッピング推奨事項
        """
        try:
            mapper = self.create_mapper(data_source)
            
            # マッパーが推奨機能をサポートしている場合
            if hasattr(mapper, 'get_suggested_mappings'):
                suggestions = mapper.get_suggested_mappings(sample_data, table_name)
                return {
                    "has_suggestions": True,
                    "suggestions": suggestions,
                    "confidence": len(suggestions) / len(sample_data) if sample_data else 0
                }
            else:
                return {
                    "has_suggestions": False,
                    "message": f"{data_source} マッパーは自動推奨をサポートしていません"
                }
                
        except Exception as e:
            logger.error(f"マッピング推奨取得エラー: {e}")
            return {
                "has_suggestions": False,
                "error": str(e)
            }


# グローバルファクトリーインスタンス
_global_factory: Optional[MapperFactory] = None


def get_mapper_factory() -> MapperFactory:
    """グローバルマッパーファクトリーを取得"""
    global _global_factory
    if _global_factory is None:
        _global_factory = MapperFactory()
    return _global_factory


def create_mapper(data_source: Union[str, DataSource]) -> BaseDataMapper:
    """マッパーを作成（便利関数）"""
    factory = get_mapper_factory()
    return factory.create_mapper(data_source)


def reset_factory():
    """ファクトリーをリセット（テスト用）"""
    global _global_factory
    _global_factory = None