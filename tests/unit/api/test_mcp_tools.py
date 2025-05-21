import pytest
import unittest.mock as mock
import os
import sys
import json
import io
import base64
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from unittest.mock import patch, MagicMock, call, ANY
from datetime import datetime, timedelta

# Add the root directory to sys.path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

@pytest.fixture
def mock_env_vars():
    """Set up mock environment variables for testing"""
    with patch.dict(os.environ, {
        "SHOPIFY_API_VERSION": "2023-10",
        "SHOPIFY_API_KEY": "test_api_key",
        "SHOPIFY_API_SECRET_KEY": "test_secret_key",
        "SHOPIFY_ACCESS_TOKEN": "test_access_token",
        "SHOPIFY_SHOP_NAME": "test-shop",
        "RATE_LIMIT_ENABLED": "true"
    }):
        yield

@pytest.fixture
def mock_orders():
    """Create mock order data"""
    return [
        {
            "id": 1001,
            "name": "#1001",
            "created_at": "2023-01-01T12:00:00Z",
            "total_price": "100.00",
            "financial_status": "paid",
            "line_items": [
                {
                    "product_id": 101,
                    "title": "Test Product 1",
                    "quantity": 2,
                    "price": "50.00"
                }
            ],
            "referring_site": "google.com",
            "landing_site": "/products/test-product-1"
        },
        {
            "id": 1002,
            "name": "#1002",
            "created_at": "2023-01-02T14:30:00Z",
            "total_price": "75.50",
            "financial_status": "paid",
            "line_items": [
                {
                    "product_id": 102,
                    "title": "Test Product 2",
                    "quantity": 1,
                    "price": "75.50"
                }
            ],
            "referring_site": "facebook.com",
            "landing_site": "/products/test-product-2"
        }
    ]

@pytest.fixture
def mock_products():
    """Create mock product data"""
    return [
        {
            "id": 101,
            "title": "Test Product 1",
            "price": "50.00",
            "vendor": "Test Vendor"
        },
        {
            "id": 102,
            "title": "Test Product 2",
            "price": "75.50",
            "vendor": "Test Vendor"
        }
    ]

@pytest.fixture
def mock_customers():
    """Create mock customer data"""
    return [
        {
            "id": 201,
            "email": "customer1@example.com",
            "created_at": "2023-01-01T10:00:00Z",
            "orders_count": 2
        },
        {
            "id": 202,
            "email": "customer2@example.com",
            "created_at": "2023-01-02T11:00:00Z",
            "orders_count": 1
        }
    ]

@pytest.mark.unit
@pytest.mark.asyncio
class TestMCPTools:
    
    @pytest.mark.asyncio
    async def test_get_orders_summary(self, mock_env_vars, mock_orders):
        """Test get_orders_summary tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders), \
             patch('matplotlib.pyplot.figure'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            from shopify_mcp_server import get_orders_summary
            
            # Call the tool
            result = await get_orders_summary(start_date="2023-01-01", end_date="2023-01-31")
            
            # Check result contains expected content
            assert "# Orders Summary" in result
            assert "Total Orders: 2" in result
            assert "Total Revenue: $175.50" in result
            assert "![Daily Sales Chart]" in result
            
            # Check the base64 image is included
            assert "data:image/png;base64," in result
    
    @pytest.mark.asyncio
    async def test_get_orders_summary_no_orders(self, mock_env_vars):
        """Test get_orders_summary tool with no orders"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=[]):
            # Import after mocking
            from shopify_mcp_server import get_orders_summary
            
            # Call the tool
            result = await get_orders_summary()
            
            # Should return a no orders message
            assert result == "No orders found for the specified period."
    
    @pytest.mark.asyncio
    async def test_get_sales_analytics(self, mock_env_vars, mock_orders):
        """Test get_sales_analytics tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders), \
             patch('matplotlib.pyplot.subplots'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            from shopify_mcp_server import get_sales_analytics
            
            # Call the tool
            result = await get_sales_analytics(period="daily", days=30)
            
            # Check result contains expected content
            assert "# Sales Analytics (Daily)" in result
            assert "Total Revenue: $175.50" in result
            assert "Total Orders: 2" in result
            assert "![Sales Analytics Chart]" in result
            
            # Check the base64 image is included
            assert "data:image/png;base64," in result
    
    @pytest.mark.asyncio
    async def test_get_product_performance(self, mock_env_vars, mock_orders, mock_products):
        """Test get_product_performance tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders), \
             patch('shopify_mcp_server.shopify_api.get_products', return_value=mock_products), \
             patch('matplotlib.pyplot.subplots'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            from shopify_mcp_server import get_product_performance
            
            # Call the tool
            result = await get_product_performance(limit=10)
            
            # Check result contains expected content
            assert "# Product Performance Analysis" in result
            assert "Test Product 1" in result
            assert "Test Product 2" in result
            assert "![Product Performance Chart]" in result
            
            # Check the base64 image is included
            assert "data:image/png;base64," in result
    
    @pytest.mark.asyncio
    async def test_get_customer_analytics(self, mock_env_vars, mock_orders, mock_customers):
        """Test get_customer_analytics tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders), \
             patch('shopify_mcp_server.shopify_api.get_customers', return_value=mock_customers), \
             patch('matplotlib.pyplot.subplots'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            from shopify_mcp_server import get_customer_analytics
            
            # Call the tool
            result = await get_customer_analytics()
            
            # Check result contains expected content
            assert "# Customer Analytics" in result
            assert "Total Customers: 2" in result
            assert "![Customer Analytics Charts]" in result
            
            # Check the base64 image is included
            assert "data:image/png;base64," in result
    
    @pytest.mark.asyncio
    async def test_get_product_order_sales_refunds(self, mock_env_vars, mock_orders):
        """Test get_product_order_sales_refunds tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders):
            # Import after mocking
            from shopify_mcp_server import get_product_order_sales_refunds
            
            # Call the tool
            result = await get_product_order_sales_refunds()
            
            # Check result contains expected content
            assert "商品" in result
            assert "注文数" in result
            assert "売上" in result
            assert "返品" in result
            assert "Test Product 1" in result
            assert "Test Product 2" in result
    
    @pytest.mark.asyncio
    async def test_get_referrer_order_sales_refunds(self, mock_env_vars, mock_orders):
        """Test get_referrer_order_sales_refunds tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders):
            # Import after mocking
            from shopify_mcp_server import get_referrer_order_sales_refunds
            
            # Call the tool
            result = await get_referrer_order_sales_refunds()
            
            # Check result contains expected content
            assert "参照元" in result
            assert "注文数" in result
            assert "売上" in result
            assert "返品" in result
            assert "google.com" in result
            assert "facebook.com" in result
    
    @pytest.mark.asyncio
    async def test_get_total_order_sales_refunds(self, mock_env_vars, mock_orders):
        """Test get_total_order_sales_refunds tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders):
            # Import after mocking
            from shopify_mcp_server import get_total_order_sales_refunds
            
            # Call the tool
            result = await get_total_order_sales_refunds()
            
            # Check result contains expected content
            assert "全体集計" in result
            assert "注文数: 2" in result
            assert "売上: ¥176" in result  # Rounded
    
    @pytest.mark.asyncio
    async def test_get_page_order_sales_refunds(self, mock_env_vars, mock_orders):
        """Test get_page_order_sales_refunds tool"""
        with patch('shopify_mcp_server.shopify_api.get_orders', return_value=mock_orders):
            # Import after mocking
            from shopify_mcp_server import get_page_order_sales_refunds
            
            # Call the tool
            result = await get_page_order_sales_refunds()
            
            # Check result contains expected content
            assert "ページ" in result
            assert "注文数" in result
            assert "売上" in result
            assert "返品" in result
            assert "/products/test-product-1" in result
            assert "/products/test-product-2" in result
    
    @pytest.mark.asyncio
    async def test_get_rate_limit_stats(self, mock_env_vars):
        """Test get_rate_limit_stats tool"""
        mock_stats = {
            "total_requests": 42,
            "throttled_requests": 5,
            "throttle_rate": 0.12,
            "current_backoff": 1.5,
            "consecutive_throttles": 2,
            "average_retry_count": 0.8,
            "recent_requests_per_second": 1.2,
            "max_requests_per_second": 2.0
        }
        
        with patch('utils.shopify_rate_limiter.get_stats', return_value=mock_stats):
            # Import after mocking
            from shopify_mcp_server import get_rate_limit_stats
            
            # Call the tool
            result = await get_rate_limit_stats()
            
            # Check result contains expected content
            assert "Shopify API レート制限状況" in result
            assert "総リクエスト数" in result
            assert "42" in result
            assert "スロットル率" in result
            assert "12.0%" in result