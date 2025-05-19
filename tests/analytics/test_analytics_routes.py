"""Tests for analytics API routes."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from src.analytics.api.analytics_routes import router, get_shopify_api


@pytest.fixture
def mock_analytics_processor():
    """Create a mock analytics processor."""
    with patch('src.analytics.api.analytics_routes.AnalyticsProcessor') as mock:
        processor = Mock()
        mock.return_value = processor
        yield processor


@pytest.fixture
def test_client(mock_analytics_processor):
    """Create a test client with mocked dependencies."""
    from fastapi import FastAPI
    
    app = FastAPI()
    app.include_router(router)
    
    # Override the dependency
    app.dependency_overrides[get_shopify_api] = lambda: Mock()
    
    client = TestClient(app)
    return client


def test_get_order_summary(test_client, mock_analytics_processor):
    """Test order summary endpoint."""
    mock_analytics_processor.get_order_summary.return_value = {
        'data': [{'period': '2025-05-01', 'order_count': 10}],
        'summary': {'total_orders': 10, 'total_revenue': 1000.0}
    }
    
    response = test_client.get('/api/v1/analytics/orders/summary')
    
    assert response.status_code == 200
    data = response.json()
    assert 'data' in data
    assert 'summary' in data
    assert data['summary']['total_orders'] == 10


def test_get_order_summary_with_params(test_client, mock_analytics_processor):
    """Test order summary with query parameters."""
    mock_analytics_processor.get_order_summary.return_value = {'data': []}
    
    response = test_client.get(
        '/api/v1/analytics/orders/summary',
        params={
            'start_date': '2025-05-01',
            'end_date': '2025-05-31',
            'group_by': 'week'
        }
    )
    
    assert response.status_code == 200
    mock_analytics_processor.get_order_summary.assert_called_once_with(
        start_date='2025-05-01',
        end_date='2025-05-31',
        group_by='week'
    )


def test_get_category_sales(test_client, mock_analytics_processor):
    """Test category sales endpoint."""
    mock_analytics_processor.get_category_sales.return_value = [
        {'category': 'Electronics', 'sales': 500.0}
    ]
    
    response = test_client.get('/api/v1/analytics/sales/by-category')
    
    assert response.status_code == 200
    data = response.json()
    assert 'data' in data
    assert len(data['data']) == 1
    assert data['data'][0]['category'] == 'Electronics'


def test_get_sales_trend(test_client, mock_analytics_processor):
    """Test sales trend endpoint."""
    mock_analytics_processor.get_sales_trend.return_value = {
        'current': [{'date': '2025-05-01', 'sales': 100}],
        'previous': [{'date': '2024-05-01', 'sales': 80}],
        'growth_rate': 25.0
    }
    
    response = test_client.get('/api/v1/analytics/sales/trend')
    
    assert response.status_code == 200
    data = response.json()
    assert 'current' in data
    assert 'growth_rate' in data
    assert data['growth_rate'] == 25.0


def test_get_geographic_distribution(test_client, mock_analytics_processor):
    """Test geographic distribution endpoint."""
    mock_analytics_processor.get_geographic_distribution.return_value = [
        {'country': 'US', 'sales': 1000.0}
    ]
    
    response = test_client.get('/api/v1/analytics/sales/geographic')
    
    assert response.status_code == 200
    data = response.json()
    assert 'data' in data
    assert len(data['data']) == 1
    assert data['data'][0]['country'] == 'US'


def test_export_data_csv(test_client, mock_analytics_processor):
    """Test data export in CSV format."""
    mock_analytics_processor.get_order_summary.return_value = {'data': []}
    mock_analytics_processor.export_data.return_value = b'name,value\nTest,42'
    
    response = test_client.get('/api/v1/analytics/export/orders?format=csv')
    
    assert response.status_code == 200
    assert response.headers['content-type'] == 'text/csv'
    assert 'attachment' in response.headers['content-disposition']


def test_export_data_excel(test_client, mock_analytics_processor):
    """Test data export in Excel format."""
    mock_analytics_processor.get_category_sales.return_value = []
    mock_analytics_processor.export_data.return_value = b'fake_excel_data'
    
    response = test_client.get('/api/v1/analytics/export/categories?format=excel')
    
    assert response.status_code == 200
    assert 'spreadsheetml' in response.headers['content-type']


def test_export_data_invalid_type(test_client, mock_analytics_processor):
    """Test export with invalid data type."""
    response = test_client.get('/api/v1/analytics/export/invalid')
    
    assert response.status_code == 400
    assert 'Invalid data type' in response.json()['detail']


def test_endpoint_error_handling(test_client, mock_analytics_processor):
    """Test error handling in endpoints."""
    mock_analytics_processor.get_order_summary.side_effect = Exception('Database error')
    
    response = test_client.get('/api/v1/analytics/orders/summary')
    
    assert response.status_code == 500
    assert 'Failed to fetch order summary' in response.json()['detail']