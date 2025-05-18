"""Tests for analytics data processor."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.analytics.dashboard.analytics_processor import AnalyticsProcessor
from src.api.shopify_api import ShopifyAPI


@pytest.fixture
def mock_shopify_api():
    """Create a mock Shopify API instance."""
    api = Mock(spec=ShopifyAPI)
    return api


@pytest.fixture
def analytics_processor(mock_shopify_api):
    """Create an analytics processor instance with mocked API."""
    return AnalyticsProcessor(shopify_api=mock_shopify_api)


@pytest.fixture
def sample_orders():
    """Sample order data for testing."""
    return [
        {
            'order_id': '1',
            'created_at': '2025-05-01T10:00:00Z',
            'total_price': 100.0,
            'currency': 'USD',
            'customer': {'id': 'cust1', 'email': 'test1@example.com'},
            'line_items': [
                {'product_type': 'Electronics', 'price': 50.0, 'quantity': 2}
            ],
            'shipping_address': {'country_code': 'US', 'province_code': 'CA'}
        },
        {
            'order_id': '2',
            'created_at': '2025-05-02T10:00:00Z',
            'total_price': 150.0,
            'currency': 'USD',
            'customer': {'id': 'cust2', 'email': 'test2@example.com'},
            'line_items': [
                {'product_type': 'Clothing', 'price': 75.0, 'quantity': 2}
            ],
            'shipping_address': {'country_code': 'CA', 'province_code': 'ON'}
        }
    ]


def test_get_order_summary_daily(analytics_processor, mock_shopify_api, sample_orders):
    """Test order summary with daily grouping."""
    mock_shopify_api.get_orders.return_value = sample_orders
    
    result = analytics_processor.get_order_summary(
        start_date='2025-05-01',
        end_date='2025-05-02',
        group_by='day'
    )
    
    assert 'data' in result
    assert 'summary' in result
    assert len(result['data']) == 2
    assert result['summary']['total_orders'] == 2
    assert result['summary']['total_revenue'] == 250.0
    assert result['summary']['average_order_value'] == 125.0


def test_get_order_summary_empty(analytics_processor, mock_shopify_api):
    """Test order summary with no orders."""
    mock_shopify_api.get_orders.return_value = []
    
    result = analytics_processor.get_order_summary()
    
    assert result['data'] == []
    assert result['summary'] == {}


def test_get_category_sales(analytics_processor, mock_shopify_api, sample_orders):
    """Test category sales calculation."""
    mock_shopify_api.get_orders.return_value = sample_orders
    
    result = analytics_processor.get_category_sales()
    
    assert len(result) == 2
    assert result[0]['category'] == 'Clothing'
    assert result[0]['sales'] == 150.0
    assert result[1]['category'] == 'Electronics'
    assert result[1]['sales'] == 100.0


def test_get_sales_trend(analytics_processor, mock_shopify_api, sample_orders):
    """Test sales trend analysis."""
    mock_shopify_api.get_orders.return_value = sample_orders
    
    result = analytics_processor.get_sales_trend(
        start_date='2025-05-01',
        end_date='2025-05-02',
        compare_previous=False
    )
    
    assert 'current' in result
    assert len(result['current']) == 2
    assert result['current'][0]['sales'] == 100.0
    assert result['current'][1]['sales'] == 150.0


def test_get_sales_trend_with_comparison(analytics_processor, mock_shopify_api, sample_orders):
    """Test sales trend with year-over-year comparison."""
    # Mock different returns for current and previous year
    mock_shopify_api.get_orders.side_effect = [
        sample_orders,  # Current year
        [   # Previous year
            {
                'order_id': '3',
                'created_at': '2024-05-01T10:00:00Z',
                'total_price': 80.0,
                'currency': 'USD'
            }
        ]
    ]
    
    result = analytics_processor.get_sales_trend(
        start_date='2025-05-01',
        end_date='2025-05-02',
        compare_previous=True
    )
    
    assert 'current' in result
    assert 'previous' in result
    assert 'growth_rate' in result
    assert result['growth_rate'] == 212.5  # (250-80)/80 * 100


def test_get_geographic_distribution(analytics_processor, mock_shopify_api, sample_orders):
    """Test geographic distribution calculation."""
    mock_shopify_api.get_orders.return_value = sample_orders
    
    result = analytics_processor.get_geographic_distribution()
    
    assert len(result) == 2
    assert result[0]['country'] == 'CA'
    assert result[0]['sales'] == 150.0
    assert result[1]['country'] == 'US'
    assert result[1]['sales'] == 100.0


def test_export_data_csv(analytics_processor):
    """Test data export in CSV format."""
    data = [
        {'name': 'Product A', 'sales': 100},
        {'name': 'Product B', 'sales': 200}
    ]
    
    result = analytics_processor.export_data(data, format='csv')
    
    assert isinstance(result, bytes)
    assert b'name,sales' in result
    assert b'Product A,100' in result


def test_export_data_json(analytics_processor):
    """Test data export in JSON format."""
    data = {'total': 100, 'average': 50}
    
    result = analytics_processor.export_data(data, format='json')
    
    assert isinstance(result, bytes)
    decoded = result.decode('utf-8')
    assert 'total' in decoded
    assert '100' in decoded


@patch('pandas.DataFrame.to_excel')
def test_export_data_excel(mock_to_excel, analytics_processor):
    """Test data export in Excel format."""
    data = [{'name': 'Test', 'value': 42}]
    
    result = analytics_processor.export_data(data, format='excel')
    
    assert isinstance(result, bytes)
    mock_to_excel.assert_called_once()


def test_export_data_invalid_format(analytics_processor):
    """Test export with invalid format."""
    with pytest.raises(ValueError, match="Unsupported export format"):
        analytics_processor.export_data({}, format='invalid')