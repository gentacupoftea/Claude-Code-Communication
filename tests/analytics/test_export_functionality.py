"""
Tests for export functionality
包括的なエクスポート機能のテストスイート
"""

import pytest
import pandas as pd
import json
import io
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.analytics.dashboard.analytics_processor import AnalyticsProcessor
from src.analytics.api.analytics_routes import export_data


class TestExportFunctionality:
    """エクスポート機能の単体テスト"""
    
    @pytest.fixture
    def mock_shopify_api(self):
        """Mock Shopify API"""
        api = Mock()
        api.get_orders.return_value = [
            {
                'id': '1',
                'created_at': '2024-01-01T00:00:00Z',
                'total_price': 100.0,
                'customer': {'id': '1', 'email': 'test@example.com'},
                'line_items': [{'product_id': '1', 'quantity': 2}]
            },
            {
                'id': '2',
                'created_at': '2024-01-02T00:00:00Z',
                'total_price': 200.0,
                'customer': {'id': '2', 'email': 'test2@example.com'},
                'line_items': [{'product_id': '2', 'quantity': 1}]
            }
        ]
        return api
    
    @pytest.fixture
    def analytics_processor(self, mock_shopify_api):
        """Analytics processor with mocked API"""
        return AnalyticsProcessor(mock_shopify_api)
    
    def test_csv_export(self, analytics_processor):
        """CSV形式のエクスポートテスト"""
        data = {
            'data': [
                {'id': '1', 'amount': 100, 'date': '2024-01-01'},
                {'id': '2', 'amount': 200, 'date': '2024-01-02'}
            ]
        }
        
        result = analytics_processor.export_data(data, format='csv')
        
        # Verify CSV format
        assert isinstance(result, bytes)
        csv_content = result.decode('utf-8')
        lines = csv_content.strip().split('\n')
        assert len(lines) == 3  # header + 2 data rows
        assert 'id,amount,date' in lines[0]
    
    def test_json_export(self, analytics_processor):
        """JSON形式のエクスポートテスト"""
        data = [
            {'id': '1', 'amount': 100, 'date': '2024-01-01'},
            {'id': '2', 'amount': 200, 'date': '2024-01-02'}
        ]
        
        result = analytics_processor.export_data(data, format='json')
        
        # Verify JSON format
        assert isinstance(result, bytes)
        json_data = json.loads(result.decode('utf-8'))
        assert len(json_data) == 2
        assert json_data[0]['id'] == '1'
    
    def test_excel_export(self, analytics_processor):
        """Excel形式のエクスポートテスト"""
        data = {
            'data': [
                {'id': '1', 'amount': 100, 'date': '2024-01-01'},
                {'id': '2', 'amount': 200, 'date': '2024-01-02'}
            ]
        }
        
        result = analytics_processor.export_data(data, format='excel')
        
        # Verify Excel format
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Excel file should start with PK (ZIP format)
        assert result[:2] == b'PK'
    
    def test_pdf_export_not_implemented(self, analytics_processor):
        """PDF形式は未実装であることを確認"""
        data = [{'id': '1', 'amount': 100}]
        
        with pytest.raises(ValueError, match="Unsupported export format: pdf"):
            analytics_processor.export_data(data, format='pdf')
    
    def test_large_dataset_export(self, analytics_processor):
        """大規模データセットのエクスポートテスト"""
        # Generate 10,000 records
        large_data = [
            {'id': str(i), 'amount': i * 10, 'date': f'2024-01-{(i % 30) + 1:02d}'}
            for i in range(10000)
        ]
        
        # Test CSV export performance
        import time
        start_time = time.time()
        result = analytics_processor.export_data(large_data, format='csv')
        end_time = time.time()
        
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert end_time - start_time < 2.0  # Should complete within 2 seconds
    
    def test_unicode_export(self, analytics_processor):
        """Unicode文字を含むデータのエクスポートテスト"""
        data = [
            {'id': '1', 'name': '日本語テスト', 'price': 100},
            {'id': '2', 'name': 'Français', 'price': 200},
            {'id': '3', 'name': '中文测试', 'price': 300}
        ]
        
        # Test all formats handle unicode
        for format_type in ['csv', 'json', 'excel']:
            result = analytics_processor.export_data(data, format=format_type)
            assert isinstance(result, bytes)
            assert len(result) > 0
    
    def test_empty_data_export(self, analytics_processor):
        """空データのエクスポートテスト"""
        empty_data = []
        
        # CSV export
        csv_result = analytics_processor.export_data(empty_data, format='csv')
        assert csv_result == b''
        
        # JSON export
        json_result = analytics_processor.export_data(empty_data, format='json')
        assert json.loads(json_result.decode('utf-8')) == []
    
    def test_filtered_data_export(self, analytics_processor):
        """フィルタリングされたデータのエクスポートテスト"""
        data = [
            {'id': '1', 'status': 'active', 'amount': 100},
            {'id': '2', 'status': 'inactive', 'amount': 200},
            {'id': '3', 'status': 'active', 'amount': 300}
        ]
        
        # Filter only active items
        df = pd.DataFrame(data)
        filtered_df = df[df['status'] == 'active']
        
        result = analytics_processor.export_data(filtered_df, format='csv')
        csv_content = result.decode('utf-8')
        lines = csv_content.strip().split('\n')
        assert len(lines) == 3  # header + 2 active rows
    
    def test_invalid_data_handling(self, analytics_processor):
        """無効なデータ形式の処理テスト"""
        # Test with None
        result = analytics_processor.export_data(None, format='csv')
        assert result == b''
        
        # Test with invalid format
        with pytest.raises(ValueError):
            analytics_processor.export_data([{'id': '1'}], format='invalid')
    
    @pytest.mark.asyncio
    async def test_export_api_endpoint(self, analytics_processor):
        """エクスポートAPIエンドポイントのテスト"""
        from fastapi.testclient import TestClient
        from src.analytics.api.analytics_routes import router
        
        # Mock dependencies
        app = Mock()
        client = TestClient(app)
        
        # Test export endpoint
        response = Mock()
        response.status_code = 200
        response.content = b'csv,content'
        
        # Verify endpoint configuration
        assert '/export/{data_type}' in [route.path for route in router.routes]


class TestExportPerformance:
    """エクスポート機能のパフォーマンステスト"""
    
    @pytest.fixture
    def large_dataset(self):
        """パフォーマンステスト用の大規模データセット"""
        return [
            {
                'id': str(i),
                'order_number': f'ORDER-{i:06d}',
                'customer_id': f'CUST-{i % 1000:04d}',
                'amount': i * 10.5,
                'status': 'completed' if i % 3 == 0 else 'pending',
                'created_at': (datetime.now() - timedelta(days=i % 365)).isoformat(),
                'items': [
                    {'product_id': f'PROD-{j}', 'quantity': j}
                    for j in range(1, (i % 5) + 2)
                ]
            }
            for i in range(10000)
        ]
    
    def test_csv_export_performance(self, large_dataset):
        """CSV エクスポートのパフォーマンステスト"""
        processor = AnalyticsProcessor(Mock())
        
        import time
        start_time = time.time()
        result = processor.export_data(large_dataset, format='csv')
        end_time = time.time()
        
        assert end_time - start_time < 1.0  # Should complete within 1 second
        assert len(result) > 1000000  # Should be at least 1MB
    
    def test_concurrent_exports(self, large_dataset):
        """同時エクスポートのパフォーマンステスト"""
        processor = AnalyticsProcessor(Mock())
        
        import concurrent.futures
        import time
        
        def export_task(format_type):
            return processor.export_data(large_dataset[:1000], format=format_type)
        
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(export_task, 'csv'),
                executor.submit(export_task, 'json'),
                executor.submit(export_task, 'excel')
            ]
            results = [f.result() for f in futures]
        end_time = time.time()
        
        assert end_time - start_time < 3.0  # Should complete within 3 seconds
        assert all(len(r) > 0 for r in results)
    
    def test_memory_efficiency(self, large_dataset):
        """メモリ効率のテスト"""
        processor = AnalyticsProcessor(Mock())
        
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Export large dataset
        result = processor.export_data(large_dataset, format='csv')
        
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB)
        assert memory_increase < 100 * 1024 * 1024
        assert len(result) > 0


class TestInternationalization:
    """国際化対応のテスト"""
    
    def test_japanese_export(self):
        """日本語データのエクスポートテスト"""
        processor = AnalyticsProcessor(Mock())
        data = [
            {'商品名': 'テスト商品', '価格': 1000, 'カテゴリ': '電化製品'},
            {'商品名': 'サンプル製品', '価格': 2000, 'カテゴリ': '家具'}
        ]
        
        # Test CSV export
        csv_result = processor.export_data(data, format='csv')
        csv_content = csv_result.decode('utf-8')
        assert '商品名' in csv_content
        assert 'テスト商品' in csv_content
        
        # Test JSON export
        json_result = processor.export_data(data, format='json')
        json_content = json.loads(json_result.decode('utf-8'))
        assert json_content[0]['商品名'] == 'テスト商品'
    
    def test_multiple_languages_export(self):
        """多言語データのエクスポートテスト"""
        processor = AnalyticsProcessor(Mock())
        data = [
            {'id': '1', 'name_en': 'Product', 'name_ja': '製品', 'name_fr': 'Produit'},
            {'id': '2', 'name_en': 'Service', 'name_ja': 'サービス', 'name_fr': 'Service'}
        ]
        
        for format_type in ['csv', 'json', 'excel']:
            result = processor.export_data(data, format=format_type)
            assert isinstance(result, bytes)
            assert len(result) > 0
    
    def test_rtl_language_export(self):
        """右から左に書く言語のエクスポートテスト"""
        processor = AnalyticsProcessor(Mock())
        data = [
            {'id': '1', 'name_ar': 'منتج', 'name_he': 'מוצר'},
            {'id': '2', 'name_ar': 'خدمة', 'name_he': 'שירות'}
        ]
        
        result = processor.export_data(data, format='json')
        json_content = json.loads(result.decode('utf-8'))
        assert json_content[0]['name_ar'] == 'منتج'
        assert json_content[1]['name_he'] == 'שירות'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])