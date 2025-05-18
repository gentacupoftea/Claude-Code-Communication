"""Test configuration and fixtures for data integration module."""

import pytest
from unittest.mock import Mock, AsyncMock
import asyncio
from typing import Dict, Any, List

@pytest.fixture
def mock_shopify_api():
    """Mock Shopify API."""
    mock = Mock()
    mock.get_products.return_value = [
        {
            "id": "prod_1",
            "title": "Test Product 1",
            "vendor": "Test Vendor",
            "price": "29.99",
            "inventory_quantity": 100
        },
        {
            "id": "prod_2",
            "title": "Test Product 2",
            "vendor": "Test Vendor",
            "price": "49.99",
            "inventory_quantity": 50
        }
    ]
    
    mock.get_orders.return_value = [
        {
            "id": "order_1",
            "email": "test@example.com",
            "total_price": "29.99",
            "financial_status": "paid",
            "line_items": [
                {
                    "product_id": "prod_1",
                    "quantity": 1,
                    "price": "29.99"
                }
            ]
        }
    ]
    
    mock.get_customers.return_value = [
        {
            "id": "cust_1",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "Customer",
            "phone": "+1234567890"
        }
    ]
    
    return mock

@pytest.fixture
def mock_analytics_api():
    """Mock Analytics API."""
    mock = Mock()
    mock.get_page_views.return_value = [
        {
            "page": "/products/test-product-1",
            "views": 1000,
            "unique_visitors": 800
        }
    ]
    
    mock.get_conversion_data.return_value = {
        "conversion_rate": 0.025,
        "cart_abandonment_rate": 0.7
    }
    
    return mock

@pytest.fixture
def mock_email_api():
    """Mock Email Marketing API."""
    mock = Mock()
    mock.get_campaign_metrics.return_value = [
        {
            "campaign_id": "camp_1",
            "opens": 5000,
            "clicks": 500,
            "conversions": 50
        }
    ]
    
    mock.get_subscriber_lists.return_value = [
        {
            "list_id": "list_1",
            "subscribers": 10000,
            "active": 8000
        }
    ]
    
    return mock

@pytest.fixture
def mock_cache_manager():
    """Mock cache manager."""
    mock = Mock()
    mock.get.return_value = None
    mock.set.return_value = None
    mock.delete.return_value = None
    mock.get_or_set.side_effect = lambda key, fetch_fn, ttl=None: fetch_fn()
    return mock

@pytest.fixture
def mock_metrics_collector():
    """Mock metrics collector."""
    mock = Mock()
    mock.record_timing.return_value = None
    mock.increment_counter.return_value = None
    mock.record_gauge.return_value = None
    mock.record_error.return_value = None
    mock.get_summary.return_value = {
        "uptime_seconds": 3600,
        "system": {"cpu_percent": 10.0, "memory_percent": 50.0},
        "timings": {},
        "counters": {},
        "errors": {}
    }
    return mock

@pytest.fixture
def mock_error_handler():
    """Mock error handler."""
    mock = Mock()
    mock.handle_error.return_value = Mock(
        error_id="err_12345",
        category="api",
        severity="medium",
        message="Test error"
    )
    return mock

@pytest.fixture
def sample_product_data() -> List[Dict[str, Any]]:
    """Sample product data for testing."""
    return [
        {
            "id": "prod_1",
            "title": "Test Product 1",
            "vendor": "Test Vendor",
            "price": "29.99",
            "inventory_quantity": 100,
            "variants": [
                {
                    "id": "var_1",
                    "title": "Small",
                    "price": "29.99",
                    "inventory_quantity": 50
                },
                {
                    "id": "var_2",
                    "title": "Large",
                    "price": "29.99",
                    "inventory_quantity": 50
                }
            ]
        },
        {
            "id": "prod_2",
            "title": "Test Product 2",
            "vendor": "Test Vendor",
            "price": "49.99",
            "inventory_quantity": 50
        }
    ]

@pytest.fixture
def sample_order_data() -> List[Dict[str, Any]]:
    """Sample order data for testing."""
    return [
        {
            "id": "order_1",
            "email": "test@example.com",
            "total_price": "29.99",
            "financial_status": "paid",
            "fulfillment_status": "fulfilled",
            "created_at": "2023-01-01T00:00:00Z",
            "customer": {
                "id": "cust_1",
                "email": "test@example.com"
            },
            "line_items": [
                {
                    "product_id": "prod_1",
                    "variant_id": "var_1",
                    "quantity": 1,
                    "price": "29.99"
                }
            ]
        }
    ]

@pytest.fixture
def sample_customer_data() -> List[Dict[str, Any]]:
    """Sample customer data for testing."""
    return [
        {
            "id": "cust_1",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "Customer",
            "phone": "+1234567890",
            "total_spent": "100.00",
            "orders_count": 3,
            "tags": "VIP,Loyal",
            "accepts_marketing": True
        }
    ]
