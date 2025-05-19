"""
Integration tests for export functionality
エクスポート機能の統合テスト
"""

import pytest
import asyncio
import json
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

from src.main import app
from src.analytics.dashboard.analytics_processor import AnalyticsProcessor
from src.api.shopify_api import ShopifyAPI
from src.api.rakuten.client import RakutenAPIClient


class TestExportIntegration:
    """エクスポート機能の統合テスト"""
    
    @pytest.fixture
    def test_client(self):
        """FastAPI test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_shopify_data(self):
        """Mock Shopify data for testing"""
        return {
            'orders': [
                {
                    'id': '1001',
                    'created_at': '2024-01-01T10:00:00Z',
                    'total_price': '1500.00',
                    'currency': 'JPY',
                    'customer': {
                        'id': '2001',
                        'email': 'customer1@example.com',
                        'first_name': 'John',
                        'last_name': 'Doe'
                    },
                    'line_items': [
                        {
                            'product_id': '3001',
                            'title': 'Product A',
                            'quantity': 2,
                            'price': '750.00'
                        }
                    ],
                    'shipping_address': {
                        'country': 'JP',
                        'province': 'Tokyo',
                        'city': 'Shibuya'
                    }
                }
            ],
            'products': [
                {
                    'id': '3001',
                    'title': 'Product A',
                    'product_type': 'Electronics',
                    'vendor': 'Vendor A',
                    'created_at': '2023-12-01T00:00:00Z'
                }
            ]
        }
    
    @pytest.fixture
    def mock_rakuten_data(self):
        """Mock Rakuten data for testing"""
        return {
            'orders': [
                {
                    'orderNumber': 'R-1001',
                    'orderDatetime': '2024-01-02T15:00:00+09:00',
                    'totalPrice': 2500,
                    'products': [
                        {
                            'productId': 'RP-001',
                            'productName': '楽天商品A',
                            'quantity': 1,
                            'price': 2500
                        }
                    ]
                }
            ],
            'categories': [
                {
                    'categoryId': 'CAT001',
                    'categoryName': '家電',
                    'categoryLevel': 1,
                    'children': [
                        {
                            'categoryId': 'CAT001-01',
                            'categoryName': 'パソコン',
                            'categoryLevel': 2
                        }
                    ]
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_export_shopify_orders(self, test_client, mock_shopify_data):
        """Shopify注文データのエクスポートテスト"""
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_get_orders:
            mock_get_orders.return_value = mock_shopify_data['orders']
            
            # Test CSV export
            response = test_client.get('/api/v1/analytics/export/orders?format=csv')
            assert response.status_code == 200
            assert response.headers['content-type'] == 'text/csv; charset=utf-8'
            
            # Verify CSV content
            csv_content = response.content.decode('utf-8')
            assert 'customer_email' in csv_content
            assert 'customer1@example.com' in csv_content
    
    @pytest.mark.asyncio
    async def test_export_rakuten_integration(self, test_client, mock_rakuten_data):
        """楽天データとの統合エクスポートテスト"""
        with patch('src.api.rakuten.client.RakutenAPIClient.get_orders') as mock_get_orders:
            mock_get_orders.return_value = mock_rakuten_data['orders']
            
            # Test JSON export
            response = test_client.get('/api/v1/analytics/export/orders?format=json&platform=rakuten')
            assert response.status_code == 200
            assert response.headers['content-type'] == 'application/json'
            
            # Verify JSON content
            json_data = response.json()
            assert len(json_data) > 0
            assert any('楽天商品A' in str(order) for order in json_data)
    
    @pytest.mark.asyncio
    async def test_combined_platform_export(self, test_client, mock_shopify_data, mock_rakuten_data):
        """複数プラットフォームの統合エクスポートテスト"""
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_shopify:
            with patch('src.api.rakuten.client.RakutenAPIClient.get_orders') as mock_rakuten:
                mock_shopify.return_value = mock_shopify_data['orders']
                mock_rakuten.return_value = mock_rakuten_data['orders']
                
                # Test combined export
                response = test_client.get('/api/v1/analytics/export/orders?format=excel&platforms=shopify,rakuten')
                assert response.status_code == 200
                assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers['content-type']
    
    @pytest.mark.asyncio
    async def test_filtered_export(self, test_client, mock_shopify_data):
        """フィルタリング付きエクスポートテスト"""
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_get_orders:
            # Filter orders by date
            filtered_orders = [
                order for order in mock_shopify_data['orders']
                if order['created_at'] >= '2024-01-01T00:00:00Z'
            ]
            mock_get_orders.return_value = filtered_orders
            
            response = test_client.get(
                '/api/v1/analytics/export/orders?format=csv&start_date=2024-01-01&end_date=2024-01-31'
            )
            assert response.status_code == 200
            
            csv_content = response.content.decode('utf-8')
            assert len(csv_content.split('\n')) > 1  # At least header + data
    
    @pytest.mark.asyncio
    async def test_large_dataset_streaming_export(self, test_client):
        """大規模データセットのストリーミングエクスポートテスト"""
        # Generate large dataset
        large_orders = [
            {
                'id': str(i),
                'created_at': f'2024-01-{(i % 30) + 1:02d}T00:00:00Z',
                'total_price': str(i * 100),
                'customer': {'email': f'customer{i}@example.com'}
            }
            for i in range(5000)
        ]
        
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_get_orders:
            mock_get_orders.return_value = large_orders
            
            response = test_client.get('/api/v1/analytics/export/orders?format=csv', stream=True)
            assert response.status_code == 200
            
            # Verify streaming response
            content_length = 0
            for chunk in response.iter_content(chunk_size=8192):
                content_length += len(chunk)
            
            assert content_length > 100000  # Should be substantial size
    
    @pytest.mark.asyncio
    async def test_visualization_data_export(self, test_client):
        """データ可視化コンポーネントとの連携テスト"""
        with patch('src.analytics.dashboard.analytics_processor.AnalyticsProcessor.get_sales_trend') as mock_trend:
            mock_trend.return_value = {
                'data': [
                    {'date': '2024-01-01', 'sales': 10000, 'orders': 5},
                    {'date': '2024-01-02', 'sales': 15000, 'orders': 8},
                    {'date': '2024-01-03', 'sales': 12000, 'orders': 6}
                ],
                'summary': {
                    'total_sales': 37000,
                    'total_orders': 19,
                    'average_order_value': 1947.37
                }
            }
            
            response = test_client.get('/api/v1/analytics/export/trend?format=json')
            assert response.status_code == 200
            
            json_data = response.json()
            assert 'data' in json_data
            assert len(json_data['data']) == 3
            assert json_data['summary']['total_sales'] == 37000
    
    def test_export_error_handling(self, test_client):
        """エクスポートエラーハンドリングのテスト"""
        # Test invalid data type
        response = test_client.get('/api/v1/analytics/export/invalid_type?format=csv')
        assert response.status_code == 400
        
        # Test invalid format
        response = test_client.get('/api/v1/analytics/export/orders?format=invalid')
        assert response.status_code == 500
        
        # Test with connection error
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_get_orders:
            mock_get_orders.side_effect = Exception("Connection error")
            
            response = test_client.get('/api/v1/analytics/export/orders?format=csv')
            assert response.status_code == 500
            assert "Failed to export data" in response.json()['detail']
    
    @pytest.mark.asyncio
    async def test_concurrent_export_requests(self, test_client):
        """同時エクスポートリクエストのテスト"""
        with patch('src.api.shopify_api.ShopifyAPI.get_orders') as mock_get_orders:
            mock_get_orders.return_value = [
                {'id': str(i), 'total_price': str(i * 100)}
                for i in range(100)
            ]
            
            # Make concurrent requests
            async def make_request(format_type):
                return test_client.get(f'/api/v1/analytics/export/orders?format={format_type}')
            
            tasks = [
                make_request('csv'),
                make_request('json'),
                make_request('excel')
            ]
            
            responses = await asyncio.gather(*tasks)
            
            # All requests should succeed
            assert all(r.status_code == 200 for r in responses)
            assert len(set(r.headers['content-type'] for r in responses)) == 3
    
    def test_export_with_authentication(self, test_client):
        """認証付きエクスポートのテスト"""
        # Test without authentication
        response = test_client.get('/api/v1/analytics/export/orders?format=csv')
        assert response.status_code in [401, 200]  # Depends on auth configuration
        
        # Test with authentication
        headers = {'Authorization': 'Bearer test_token'}
        with patch('src.auth.verify_token') as mock_verify:
            mock_verify.return_value = {'user_id': 'test_user'}
            
            response = test_client.get(
                '/api/v1/analytics/export/orders?format=csv',
                headers=headers
            )
            assert response.status_code == 200


class TestCrossPlatformExport:
    """クロスプラットフォームエクスポートテスト"""
    
    def test_shopify_to_rakuten_format_conversion(self):
        """ShopifyからRakuten形式への変換テスト"""
        processor = AnalyticsProcessor(Mock())
        
        shopify_data = {
            'id': '1001',
            'created_at': '2024-01-01T00:00:00Z',
            'total_price': '1500.00',
            'customer': {'email': 'test@example.com'}
        }
        
        # Convert to Rakuten format
        rakuten_format = {
            'orderNumber': f"S-{shopify_data['id']}",
            'orderDatetime': shopify_data['created_at'],
            'totalPrice': float(shopify_data['total_price']),
            'customerEmail': shopify_data['customer']['email']
        }
        
        # Export in both formats
        original_export = processor.export_data([shopify_data], format='json')
        converted_export = processor.export_data([rakuten_format], format='json')
        
        assert len(original_export) > 0
        assert len(converted_export) > 0
    
    def test_multi_currency_export(self):
        """多通貨データのエクスポートテスト"""
        processor = AnalyticsProcessor(Mock())
        
        multi_currency_data = [
            {'id': '1', 'amount': 1000, 'currency': 'JPY'},
            {'id': '2', 'amount': 10, 'currency': 'USD'},
            {'id': '3', 'amount': 8, 'currency': 'EUR'}
        ]
        
        # Export with currency conversion
        result = processor.export_data(multi_currency_data, format='csv')
        csv_content = result.decode('utf-8')
        
        assert 'JPY' in csv_content
        assert 'USD' in csv_content
        assert 'EUR' in csv_content


if __name__ == '__main__':
    pytest.main([__file__, '-v'])