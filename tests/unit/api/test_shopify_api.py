import pytest
import unittest.mock as mock
import os
import sys
import json
import requests
from unittest.mock import patch, MagicMock, call
from datetime import datetime

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
def mock_response():
    """Create a mock response for requests"""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {}
    mock_resp.headers = {'X-Shopify-Shop-Api-Call-Limit': '10/40'}
    return mock_resp

@pytest.mark.unit
@pytest.mark.rest_api
class TestShopifyAPIClient:
    
    def test_init(self, mock_env_vars):
        """Test API client initialization"""
        # Import after setting env vars
        from shopify_mcp_server import ShopifyAPI
        
        api = ShopifyAPI()
        assert api.base_url == "https://test-shop.myshopify.com/admin/api/2023-10"
        assert api.headers == {
            "X-Shopify-Access-Token": "test_access_token",
            "Content-Type": "application/json"
        }
    
    def test_make_request_success(self, mock_env_vars, mock_response):
        """Test successful API request"""
        with patch('requests.request', return_value=mock_response) as mock_req:
            # Set up mock response data
            mock_response.json.return_value = {"orders": [{"id": 1, "name": "Test Order"}]}
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            result = api._make_request("GET", "orders.json")
            
            # Verify the request
            mock_req.assert_called_once_with(
                method="GET",
                url="https://test-shop.myshopify.com/admin/api/2023-10/orders.json",
                headers={
                    "X-Shopify-Access-Token": "test_access_token",
                    "Content-Type": "application/json"
                },
                params=None,
                json=None,
                verify=False
            )
            
            assert result == {"orders": [{"id": 1, "name": "Test Order"}]}
    
    def test_make_request_rate_limit_warning(self, mock_env_vars, mock_response):
        """Test rate limit warning in API request"""
        with patch('requests.request', return_value=mock_response) as mock_req, \
             patch('logging.warning') as mock_warning:
            # Set up near-limit response
            mock_response.headers = {'X-Shopify-Shop-Api-Call-Limit': '35/40'}
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            api._make_request("GET", "orders.json")
            
            # Verify warning was logged
            mock_warning.assert_called_once()
            assert "Rate Limit Warning" in mock_warning.call_args[0][0]
    
    def test_make_request_http_error(self, mock_env_vars):
        """Test HTTP error handling in API request"""
        with patch('requests.request') as mock_req, \
             patch('logging.error') as mock_error:
            # Set up HTTP error
            mock_req.side_effect = requests.exceptions.HTTPError("404 Not Found")
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            result = api._make_request("GET", "orders.json")
            
            # Verify error was logged and empty dict returned
            mock_error.assert_called_once()
            assert "HTTP error" in mock_error.call_args[0][0]
            assert result == {}
    
    def test_make_request_rate_limit_error(self, mock_env_vars):
        """Test rate limit error handling in API request"""
        with patch('requests.request') as mock_req, \
             patch('logging.error') as mock_error:
            # Set up rate limit error
            mock_resp = MagicMock()
            mock_resp.status_code = 429
            mock_error_instance = requests.exceptions.HTTPError("429 Too Many Requests")
            mock_error_instance.response = mock_resp
            mock_req.side_effect = mock_error_instance
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            
            # Should re-raise for the rate limiter to handle
            with pytest.raises(requests.exceptions.HTTPError):
                api._make_request("GET", "orders.json")
            
            # Verify error was logged
            mock_error.assert_called_once()
            assert "Rate limit exceeded" in mock_error.call_args[0][0]
    
    def test_get_orders(self, mock_env_vars):
        """Test get_orders method"""
        with patch('shopify_mcp_server.ShopifyAPI._make_request') as mock_req:
            # Set up mock response
            mock_req.return_value = {"orders": [{"id": 1, "name": "Test Order"}]}
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            result = api.get_orders("2023-01-01", "2023-01-31")
            
            # Verify the request
            mock_req.assert_called_once_with(
                "GET", 
                "orders.json", 
                params={
                    "status": "any", 
                    "limit": 250,
                    "created_at_min": "2023-01-01",
                    "created_at_max": "2023-01-31"
                }
            )
            
            assert result == [{"id": 1, "name": "Test Order"}]
    
    def test_get_products(self, mock_env_vars):
        """Test get_products method"""
        with patch('shopify_mcp_server.ShopifyAPI._make_request') as mock_req:
            # Set up mock response
            mock_req.return_value = {"products": [{"id": 1, "title": "Test Product"}]}
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            result = api.get_products()
            
            # Verify the request
            mock_req.assert_called_once_with(
                "GET", 
                "products.json", 
                params={"limit": 250}
            )
            
            assert result == [{"id": 1, "title": "Test Product"}]
    
    def test_get_customers(self, mock_env_vars):
        """Test get_customers method"""
        with patch('shopify_mcp_server.ShopifyAPI._make_request') as mock_req:
            # Set up mock response
            mock_req.return_value = {"customers": [{"id": 1, "email": "test@example.com"}]}
            
            # Import after setting env vars
            from shopify_mcp_server import ShopifyAPI
            
            api = ShopifyAPI()
            result = api.get_customers()
            
            # Verify the request
            mock_req.assert_called_once_with(
                "GET", 
                "customers.json", 
                params={"limit": 250}
            )
            
            assert result == [{"id": 1, "email": "test@example.com"}]