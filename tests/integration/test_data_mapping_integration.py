"""
データマッピング統合テスト
複数のコンポーネントを組み合わせた統合テスト
"""
import pytest
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any

from src.data_integration.mapping.mapper_factory import MapperFactory, DataSource
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_processing.ai_cleaner import AIDataCleaner
from src.file_import.file_upload import FileUploadHandler
from src.google_sheets.client import GoogleSheetsClient
from src.data_integration.mapping.utils.schema_validator import SchemaValidator


class TestDataMappingIntegration:
    """データマッピング統合テスト"""
    
    @pytest.fixture
    async def setup_components(self):
        """テスト用コンポーネントのセットアップ"""
        schema_registry = SchemaRegistry()
        mapper_factory = MapperFactory(schema_registry)
        ai_cleaner = AIDataCleaner()
        file_handler = FileUploadHandler()
        schema_validator = SchemaValidator(schema_registry.get_schema())
        
        return {
            'schema_registry': schema_registry,
            'mapper_factory': mapper_factory,
            'ai_cleaner': ai_cleaner,
            'file_handler': file_handler,
            'schema_validator': schema_validator
        }
    
    @pytest.mark.asyncio
    async def test_csv_file_to_dwh_pipeline(self, setup_components, tmp_path):
        """CSVファイルからDWHへのデータパイプラインテスト"""
        components = await setup_components
        
        # テスト用CSVファイル作成
        csv_content = """product_id,name,sku,price,stock_quantity,created_at
PROD001,テスト商品1,SKU001,1000,50,2024-01-01
PROD002,テスト商品2,SKU002,2500.50,0,2024-01-02
PROD003,テスト商品3,SKU003,invalid_price,100,2024-01-03"""
        
        csv_file = tmp_path / "products.csv"
        csv_file.write_text(csv_content, encoding='utf-8')
        
        # ファイルアップロード処理
        with open(csv_file, 'rb') as f:
            upload_result = await components['file_handler'].handle_upload(
                f, 'products.csv', 'text/csv'
            )
        
        assert upload_result.success is True
        
        # データクリーニング
        raw_data = upload_result.parsed_data
        cleaned_data, cleaning_report = await components['ai_cleaner'].clean_data(raw_data)
        
        assert len(cleaned_data) >= 2  # 無効なデータが除外される可能性
        assert cleaning_report.total_records == 3
        assert cleaning_report.cleaned_records >= 2
        
        # データマッピング
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        mapping_result = await mapper.map_data(cleaned_data, 'products')
        
        assert mapping_result.success is True
        assert len(mapping_result.mapped_data) >= 2
        
        # スキーマ検証
        for record in mapping_result.mapped_data:
            validation_result = components['schema_validator'].validate_record(
                record, 'products'
            )
            assert validation_result.is_valid is True
    
    @pytest.mark.asyncio
    async def test_multi_source_data_integration(self, setup_components):
        """複数データソースの統合テスト"""
        components = await setup_components
        
        # 各データソースのサンプルデータ
        test_data_sources = {
            DataSource.SHOPIFY: [
                {
                    'id': 12345,
                    'title': 'Shopify商品',
                    'variants': [{'sku': 'SHOP001', 'price': '1500.00'}],
                    'created_at': '2024-01-01T10:00:00Z'
                }
            ],
            DataSource.AMAZON: [
                {
                    'asin': 'B001234567',
                    'title': 'Amazon商品',
                    'price': {'value': 2000.00, 'currency': 'JPY'},
                    'created_date': '2024-01-02T12:00:00Z'
                }
            ],
            DataSource.RAKUTEN: [
                {
                    'itemNumber': 'R001',
                    'itemName': '楽天商品',
                    'itemPrice': 2500,
                    'taxFlag': 1,
                    'regDate': '20240103'
                }
            ]
        }
        
        all_mapped_products = []
        
        # 各データソースを処理
        for source, data in test_data_sources.items():
            # マッパー作成
            mapper = components['mapper_factory'].create_mapper(source)
            
            # データマッピング
            result = await mapper.map_data(data, 'products')
            assert result.success is True
            
            # スキーマ検証
            for record in result.mapped_data:
                validation = components['schema_validator'].validate_record(
                    record, 'products'
                )
                assert validation.is_valid is True
            
            all_mapped_products.extend(result.mapped_data)
        
        # 統合結果の検証
        assert len(all_mapped_products) == 3
        
        # データソース識別
        assert any(p['source'] == 'shopify' for p in all_mapped_products)
        assert any(p['source'] == 'amazon' for p in all_mapped_products)
        assert any(p['source'] == 'rakuten' for p in all_mapped_products)
    
    @pytest.mark.asyncio
    async def test_error_handling_pipeline(self, setup_components):
        """エラーハンドリングパイプラインテスト"""
        components = await setup_components
        
        # 様々な問題を含むデータ
        problematic_data = [
            {
                'product_id': 'PROD001',
                'name': '',  # 空の名前
                'price': 'not_a_number',  # 無効な価格
                'stock_quantity': -50,  # 負の在庫
                'created_at': 'invalid_date'
            },
            {
                'product_id': '',  # 空のID
                'name': 'Valid Product',
                'price': '1000',
                'stock_quantity': '100'
            },
            {
                # 必須フィールドが欠損
                'price': '2000'
            }
        ]
        
        # データクリーニング
        cleaned_data, report = await components['ai_cleaner'].clean_data(
            problematic_data
        )
        
        # エラーレポートの検証
        assert report.error_count > 0
        assert len(report.cleaning_actions) > 0
        
        # マッピング処理
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        mapping_result = await mapper.map_data(cleaned_data, 'products')
        
        # 部分的な成功を確認
        assert mapping_result.success is True  # 一部のデータは処理可能
        assert mapping_result.error_count > 0
        assert len(mapping_result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_data_type_conversion_pipeline(self, setup_components):
        """データ型変換パイプラインテスト"""
        components = await setup_components
        
        # 様々なデータ型を含むデータ
        mixed_type_data = [
            {
                'order_number': 'ORD001',
                'created_at': '2024-01-15',  # 日付文字列
                'total_amount': '1234.56',   # 文字列の数値
                'quantity': '10',             # 文字列の整数
                'is_paid': 'true',           # 文字列のブール値
                'customer_id': 123            # 数値のID
            }
        ]
        
        # マッピング処理
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        mapper.auto_detect_types = True
        
        result = await mapper.map_data(mixed_type_data, 'orders')
        
        assert result.success is True
        order = result.mapped_data[0]
        
        # 型変換の検証
        assert isinstance(order['created_at'], datetime)
        assert isinstance(order['total_amount'], Decimal)
        assert isinstance(order.get('quantity'), int)
        assert order.get('is_paid') is True
        assert isinstance(order['customer_id'], str)  # IDは文字列に統一
    
    @pytest.mark.asyncio
    async def test_schema_evolution_handling(self, setup_components):
        """スキーマ進化への対応テスト"""
        components = await setup_components
        
        # 新しいフィールドを含むデータ
        evolved_data = [
            {
                'product_id': 'PROD001',
                'name': 'テスト商品',
                'price': '1000',
                'new_field': 'new_value',  # スキーマにない新フィールド
                'custom_attribute_1': 'value1',
                'custom_attribute_2': 'value2'
            }
        ]
        
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        result = await mapper.map_data(evolved_data, 'products')
        
        assert result.success is True
        assert len(result.warnings) > 0  # 未知のフィールドに対する警告
        
        product = result.mapped_data[0]
        assert 'metadata' in product  # カスタムフィールドはmetadataに格納
        assert product['metadata'].get('new_field') == 'new_value'


@pytest.mark.asyncio
class TestPerformanceIntegration:
    """パフォーマンス関連の統合テスト"""
    
    async def test_large_dataset_processing(self, setup_components):
        """大規模データセットの処理テスト"""
        components = await setup_components
        
        # 10,000件のテストデータ生成
        large_dataset = []
        for i in range(10000):
            large_dataset.append({
                'product_id': f'PROD{i:05d}',
                'name': f'商品{i}',
                'sku': f'SKU{i:05d}',
                'price': str(1000 + i),
                'stock_quantity': str(i % 100),
                'created_at': '2024-01-01'
            })
        
        # 処理時間を計測
        import time
        start_time = time.time()
        
        # データクリーニング
        cleaned_data, _ = await components['ai_cleaner'].clean_data(
            large_dataset,
            batch_size=1000  # バッチ処理
        )
        
        # マッピング処理
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        result = await mapper.map_data(cleaned_data, 'products')
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # パフォーマンス検証
        assert result.success is True
        assert len(result.mapped_data) == 10000
        assert processing_time < 60  # 60秒以内に処理完了
        
        print(f"Processed 10,000 records in {processing_time:.2f} seconds")