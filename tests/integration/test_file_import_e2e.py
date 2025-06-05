"""
ファイルインポートE2E統合テスト
ファイルアップロードからDWHへのデータ保存までの完全なフローを検証
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path
from datetime import datetime
from decimal import Decimal
import csv
import json
from typing import List, Dict, Any

from src.file_import.file_upload import FileUploadHandler
from src.file_import.csv_parser import CSVParser
from src.file_import.excel_parser import ExcelParser
from src.data_processing.ai_cleaner import AIDataCleaner
from src.data_integration.mapping.mapper_factory import MapperFactory, DataSource
from src.data_integration.mapping.schema_registry import SchemaRegistry


@pytest.mark.asyncio
class TestFileImportE2E:
    """ファイルインポートのエンドツーエンドテスト"""
    
    @pytest.fixture
    async def setup_e2e_components(self):
        """E2Eテスト用のコンポーネントをセットアップ"""
        schema_registry = SchemaRegistry()
        mapper_factory = MapperFactory(schema_registry)
        ai_cleaner = AIDataCleaner()
        file_handler = FileUploadHandler()
        
        return {
            'file_handler': file_handler,
            'ai_cleaner': ai_cleaner,
            'mapper_factory': mapper_factory,
            'schema_registry': schema_registry
        }
    
    async def test_csv_file_complete_flow(self, setup_e2e_components):
        """CSVファイルの完全なインポートフローテスト"""
        components = await setup_e2e_components
        
        # テスト用CSVファイルを作成
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            csv_writer = csv.DictWriter(f, fieldnames=['product_id', 'name', 'sku', 'price', 'stock_quantity', 'created_at'])
            csv_writer.writeheader()
            csv_writer.writerows([
                {
                    'product_id': 'PROD001',
                    'name': 'テスト商品1',
                    'sku': 'SKU001',
                    'price': '1000.00',
                    'stock_quantity': '50',
                    'created_at': '2024-01-01'
                },
                {
                    'product_id': 'PROD002',
                    'name': 'テスト商品2',
                    'sku': 'SKU002',
                    'price': '2500.50',
                    'stock_quantity': '0',
                    'created_at': '2024-01-02'
                },
                {
                    'product_id': 'PROD003',
                    'name': '',  # 空の名前（クリーニング対象）
                    'sku': 'SKU003',
                    'price': 'invalid',  # 無効な価格（クリーニング対象）
                    'stock_quantity': '100',
                    'created_at': '2024-01-03'
                }
            ])
            temp_file_path = f.name
        
        try:
            # ステップ1: ファイルアップロードと検証
            with open(temp_file_path, 'rb') as file:
                upload_result = await components['file_handler'].handle_upload(
                    file, 
                    'products.csv',
                    'text/csv'
                )
            
            assert upload_result.success is True
            assert upload_result.file_id is not None
            assert len(upload_result.parsed_data) == 3
            
            # ステップ2: AIデータクリーニング
            raw_data = upload_result.parsed_data
            cleaned_data, cleaning_report = await components['ai_cleaner'].clean_data(raw_data)
            
            assert cleaning_report.total_records == 3
            assert cleaning_report.cleaned_records >= 2  # 少なくとも2つは有効なレコード
            assert cleaning_report.quality_score >= 0.6  # 品質スコアチェック
            
            # ステップ3: DWHスキーママッピング
            mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
            mapping_result = await mapper.map_data(cleaned_data, 'products')
            
            assert mapping_result.success is True
            assert len(mapping_result.mapped_data) >= 2
            
            # マッピング結果の検証
            for product in mapping_result.mapped_data:
                # 必須フィールドの存在確認
                assert 'id' in product
                assert 'external_id' in product
                assert 'source' in product
                assert product['source'] == 'file'
                
                # データ型の検証
                if product['external_id'] == 'PROD001':
                    assert product['name'] == 'テスト商品1'
                    assert product['sku'] == 'SKU001'
                    assert product['price'] == Decimal('1000.00')
                    assert product['stock_quantity'] == 50
                    assert isinstance(product['created_at'], datetime)
            
            # ステップ4: データ品質の最終確認
            final_quality_check = self._verify_data_quality(mapping_result.mapped_data)
            assert final_quality_check['is_valid'] is True
            assert final_quality_check['error_count'] == 0
            
        finally:
            # テンポラリファイルをクリーンアップ
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    async def test_shopify_data_complete_flow(self, setup_e2e_components):
        """Shopifyデータの完全なインポートフローテスト"""
        components = await setup_e2e_components
        
        # Shopify形式のサンプルデータ
        shopify_products = [
            {
                'id': 12345,
                'title': 'Shopifyテスト商品1',
                'body_html': '<p>商品説明</p>',
                'vendor': 'テストベンダー',
                'product_type': 'テストタイプ',
                'created_at': '2024-01-15T10:00:00Z',
                'updated_at': '2024-01-15T10:00:00Z',
                'published_at': '2024-01-15T10:00:00Z',
                'tags': 'test,sample',
                'variants': [
                    {
                        'id': 111,
                        'product_id': 12345,
                        'title': 'Default Title',
                        'price': '1500.00',
                        'sku': 'SHOP-SKU001',
                        'inventory_quantity': 25,
                        'weight': 0.5,
                        'weight_unit': 'kg'
                    }
                ],
                'images': [
                    {
                        'id': 222,
                        'product_id': 12345,
                        'src': 'https://example.com/image1.jpg'
                    }
                ]
            },
            {
                'id': 12346,
                'title': 'Shopifyテスト商品2',
                'body_html': '<p>別の商品説明</p>',
                'vendor': 'テストベンダー2',
                'product_type': 'テストタイプ2',
                'created_at': '2024-01-16T10:00:00Z',
                'updated_at': '2024-01-16T10:00:00Z',
                'published_at': None,  # 未公開商品
                'tags': '',
                'variants': [
                    {
                        'id': 112,
                        'product_id': 12346,
                        'title': 'サイズ L',
                        'price': '2000.00',
                        'sku': 'SHOP-SKU002-L',
                        'inventory_quantity': 0,  # 在庫切れ
                        'weight': 0.7,
                        'weight_unit': 'kg'
                    }
                ],
                'images': []
            }
        ]
        
        # ステップ1: データクリーニング（Shopifyデータは通常クリーンなのでスキップ可能）
        cleaned_data, cleaning_report = await components['ai_cleaner'].clean_data(
            shopify_products,
            skip_cleaning=['id', 'created_at', 'updated_at']  # IDと日付はそのまま保持
        )
        
        assert len(cleaned_data) == 2
        
        # ステップ2: Shopifyマッパーでマッピング
        mapper = components['mapper_factory'].create_mapper(DataSource.SHOPIFY)
        mapping_result = await mapper.map_data(cleaned_data, 'products')
        
        assert mapping_result.success is True
        assert len(mapping_result.mapped_data) == 2
        
        # マッピング結果の詳細検証
        product1 = next(p for p in mapping_result.mapped_data if p['external_id'] == 'shopify_12345')
        assert product1['name'] == 'Shopifyテスト商品1'
        assert product1['sku'] == 'SHOP-SKU001'
        assert product1['price'] == Decimal('1500.00')
        assert product1['stock_quantity'] == 25
        assert product1['status'] == 'active'
        assert product1['weight'] == Decimal('0.5')
        assert len(product1['images']) == 1
        
        product2 = next(p for p in mapping_result.mapped_data if p['external_id'] == 'shopify_12346')
        assert product2['status'] == 'draft'  # 未公開なのでdraft
        assert product2['stock_quantity'] == 0
        
        # ステップ3: データ整合性チェック
        integrity_check = self._verify_referential_integrity(mapping_result.mapped_data)
        assert integrity_check['is_valid'] is True
    
    async def test_error_recovery_flow(self, setup_e2e_components):
        """エラー発生時のリカバリーフローテスト"""
        components = await setup_e2e_components
        
        # 問題のあるデータセット
        problematic_data = [
            {
                'product_id': 'PROD001',
                'name': 'Valid Product',
                'price': '1000',
                'stock_quantity': '10'
            },
            {
                # 必須フィールド欠損
                'name': 'Missing ID Product',
                'price': '2000'
            },
            {
                'product_id': 'PROD003',
                'name': 'Invalid Price Product',
                'price': 'not_a_number',  # 型変換エラー
                'stock_quantity': '-5'  # 無効な在庫数
            },
            {
                'product_id': 'PROD001',  # 重複ID
                'name': 'Duplicate ID Product',
                'price': '3000',
                'stock_quantity': '20'
            }
        ]
        
        # エラーハンドリングを含むフロー実行
        # ステップ1: データクリーニング（エラーを修正）
        cleaned_data, cleaning_report = await components['ai_cleaner'].clean_data(
            problematic_data,
            fix_errors=True,
            remove_duplicates=True
        )
        
        assert cleaning_report.error_count > 0
        assert cleaning_report.cleaning_actions > 0
        
        # ステップ2: マッピング（部分的成功を許可）
        mapper = components['mapper_factory'].create_mapper(DataSource.FILE)
        mapping_result = await mapper.map_data(cleaned_data, 'products')
        
        assert mapping_result.success is True  # 部分的成功でもTrue
        assert len(mapping_result.mapped_data) >= 1  # 少なくとも1つは成功
        assert len(mapping_result.errors) > 0  # エラーも記録されている
        
        # エラーログの検証
        assert any('Missing required field' in str(e) for e in mapping_result.errors)
        
        # リカバリー結果の検証
        valid_products = [p for p in mapping_result.mapped_data if p.get('name')]
        assert len(valid_products) >= 1
        assert all(p['price'] > 0 for p in valid_products if 'price' in p)
    
    def _verify_data_quality(self, mapped_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """データ品質を検証"""
        errors = []
        warnings = []
        
        for record in mapped_data:
            # 必須フィールドチェック
            required_fields = ['id', 'external_id', 'source', 'name']
            for field in required_fields:
                if field not in record or record[field] is None:
                    errors.append(f"Missing required field: {field}")
            
            # データ型チェック
            if 'price' in record and record['price'] is not None:
                if not isinstance(record['price'], Decimal):
                    errors.append(f"Invalid price type: {type(record['price'])}")
                elif record['price'] < 0:
                    errors.append("Negative price detected")
            
            # 在庫数チェック
            if 'stock_quantity' in record and record['stock_quantity'] is not None:
                if not isinstance(record['stock_quantity'], int):
                    errors.append(f"Invalid stock quantity type: {type(record['stock_quantity'])}")
                elif record['stock_quantity'] < 0:
                    warnings.append("Negative stock quantity")
        
        return {
            'is_valid': len(errors) == 0,
            'error_count': len(errors),
            'warning_count': len(warnings),
            'errors': errors,
            'warnings': warnings
        }
    
    def _verify_referential_integrity(self, mapped_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """参照整合性を検証"""
        errors = []
        external_ids = set()
        
        for record in mapped_data:
            # 重複IDチェック
            ext_id = record.get('external_id')
            if ext_id in external_ids:
                errors.append(f"Duplicate external_id: {ext_id}")
            else:
                external_ids.add(ext_id)
            
            # ソース整合性チェック
            if 'source' not in record:
                errors.append("Missing source field")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors
        }