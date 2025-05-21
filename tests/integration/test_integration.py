import pytest
import unittest.mock as mock
import os
import sys
import json
import asyncio
import subprocess
import time
import requests
from unittest.mock import patch, MagicMock, call
import signal

# Add the root directory to sys.path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Skip tests if integration tests are disabled
pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS", "0") != "1",
    reason="Integration tests are disabled. Set RUN_INTEGRATION_TESTS=1 to enable."
)

@pytest.fixture
def mock_env_file():
    """Create a temporary .env file for testing"""
    env_content = """
    LOG_LEVEL=INFO
    MCP_LOG_LEVEL=INFO
    SHOPIFY_API_VERSION=2023-10
    SHOPIFY_API_KEY=test_api_key
    SHOPIFY_API_SECRET_KEY=test_secret_key
    SHOPIFY_ACCESS_TOKEN=test_access_token
    SHOPIFY_SHOP_NAME=test-shop
    RATE_LIMIT_ENABLED=true
    CACHE_TTL=60
    CACHE_MAX_SIZE=100
    CACHE_MAX_MEMORY_MB=10
    """
    
    # Write the test .env file
    env_path = os.path.join(os.path.dirname(__file__), '../../.env.test')
    with open(env_path, 'w') as f:
        f.write(env_content.strip())
    
    yield env_path
    
    # Cleanup
    if os.path.exists(env_path):
        os.remove(env_path)

@pytest.fixture
def mock_shopify_api():
    """Mock the Shopify API responses"""
    with patch('requests.request') as mock_request:
        # Mock order response
        orders_response = MagicMock()
        orders_response.status_code = 200
        orders_response.headers = {'X-Shopify-Shop-Api-Call-Limit': '10/40'}
        orders_response.json.return_value = {
            "orders": [
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
                    ]
                }
            ]
        }
        
        # Mock product response
        products_response = MagicMock()
        products_response.status_code = 200
        products_response.headers = {'X-Shopify-Shop-Api-Call-Limit': '11/40'}
        products_response.json.return_value = {
            "products": [
                {
                    "id": 101,
                    "title": "Test Product 1",
                    "price": "50.00",
                    "vendor": "Test Vendor"
                }
            ]
        }
        
        # Set up the mock request to return appropriate responses
        def mock_request_side_effect(*args, **kwargs):
            url = kwargs.get('url', '')
            if 'orders.json' in url:
                return orders_response
            elif 'products.json' in url:
                return products_response
            else:
                response = MagicMock()
                response.status_code = 404
                return response
        
        mock_request.side_effect = mock_request_side_effect
        yield mock_request

@pytest.fixture
def server_process():
    """Start the MCP server in a subprocess for integration testing"""
    # This would start the actual server if RUN_INTEGRATION_TESTS=1
    # For now, we'll just mock this behavior
    
    # In a real test, you would:
    # 1. Start the server process
    # 2. Wait for it to be ready
    # 3. Yield control back to the test
    # 4. Clean up the server process after the test
    
    # Since we're keeping this as a template, we'll just mock it
    with patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp:
        mock_instance = mock_fastmcp.return_value
        mock_instance.run = MagicMock()
        
        yield mock_instance
        
        # Cleanup would happen here in a real test

@pytest.mark.integration
class TestServerIntegration:
    
    def test_server_startup(self, mock_env_file, mock_shopify_api):
        """Test server startup and basic initialization"""
        try:
            # Import the module (this will execute the module-level code)
            import shopify_mcp_server
            
            # Verify the API client was initialized
            assert hasattr(shopify_mcp_server, 'shopify_api')
            assert shopify_mcp_server.shopify_api.base_url == "https://test-shop.myshopify.com/admin/api/2023-10"
            
            # Verify tools were registered
            assert hasattr(shopify_mcp_server, 'get_orders_summary')
            assert hasattr(shopify_mcp_server, 'get_sales_analytics')
            assert hasattr(shopify_mcp_server, 'get_product_performance')
            assert hasattr(shopify_mcp_server, 'get_customer_analytics')
            
        except Exception as e:
            pytest.fail(f"Server startup failed: {e}")
    
    @pytest.mark.asyncio
    async def test_get_orders_tool(self, mock_env_file, mock_shopify_api):
        """Test the get_orders_summary tool in integration mode"""
        # Import the module
        import shopify_mcp_server
        
        # Call the tool
        result = await shopify_mcp_server.get_orders_summary()
        
        # Verify the result
        assert "# Orders Summary" in result
        assert "Total Orders: 1" in result
        assert "Total Revenue: $100.00" in result
        
        # Verify the API was called
        mock_shopify_api.assert_called()
        assert any('orders.json' in call[2].get('url', '') for call in mock_shopify_api.mock_calls)
    
    @pytest.mark.asyncio
    async def test_get_product_performance_tool(self, mock_env_file, mock_shopify_api):
        """Test the get_product_performance tool in integration mode"""
        # Import the module
        import shopify_mcp_server
        
        # Call the tool
        result = await shopify_mcp_server.get_product_performance()
        
        # Verify the result
        assert "# Product Performance Analysis" in result
        assert "Test Product 1" in result
        
        # Verify the API was called for both orders and products
        mock_shopify_api.assert_called()
        assert any('orders.json' in call[2].get('url', '') for call in mock_shopify_api.mock_calls)
        assert any('products.json' in call[2].get('url', '') for call in mock_shopify_api.mock_calls)

@pytest.mark.integration
class TestEndToEndWorkflow:
    
    @pytest.mark.asyncio
    async def test_basic_workflow(self, mock_env_file, mock_shopify_api):
        """Test a basic workflow using multiple tools in sequence"""
        # Import the module
        import shopify_mcp_server
        
        # 1. Get orders summary
        orders_result = await shopify_mcp_server.get_orders_summary(
            start_date="2023-01-01", 
            end_date="2023-01-31"
        )
        assert "# Orders Summary" in orders_result
        
        # 2. Get product performance
        product_result = await shopify_mcp_server.get_product_performance(limit=5)
        assert "# Product Performance Analysis" in product_result
        
        # 3. Check rate limit statistics
        rate_limit_result = await shopify_mcp_server.get_rate_limit_stats()
        assert "Shopify API レート制限状況" in rate_limit_result
        
        # Verify the number of API calls
        api_calls = sum(1 for call in mock_shopify_api.mock_calls 
                     if isinstance(call[2].get('url', ''), str) and 
                     ('orders.json' in call[2].get('url', '') or
                      'products.json' in call[2].get('url', '')))
        
        # We should see fewer API calls than tool calls due to caching
        assert api_calls <= 3