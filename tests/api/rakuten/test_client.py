"""
Tests for Rakuten API Client
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import httpx
from datetime import datetime

from src.api.rakuten import (
    RakutenAPIClient,
    RakutenAPIError,
    RakutenCredentials,
    RakutenAuth
)
from src.api.abstract import ProductStatus, OrderStatus


class TestRakutenAPIClient:
    """Test Rakuten API client"""
    
    @pytest.fixture
    def credentials(self):
        """Test credentials"""
        return {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop',
            'test_mode': True
        }
    
    @pytest.fixture
    async def client(self, credentials):
        """Create test client"""
        client = RakutenAPIClient(credentials)
        # Mock auth
        client.auth = Mock()
        client.auth.ensure_valid_token = AsyncMock(return_value=True)
        client.auth.get_auth_header = Mock(return_value={'Authorization': 'Bearer test_token'})
        return client
    
    @pytest.mark.asyncio
    async def test_initialization(self, credentials):
        """Test client initialization"""
        client = RakutenAPIClient(credentials)
        
        assert client.shop_id == 'test_shop'
        assert client.test_mode is True
        assert client.platform_name == 'rakuten'
    
    @pytest.mark.asyncio
    async def test_authentication(self, client):
        """Test authentication"""
        client.auth.authenticate = AsyncMock(return_value=True)
        
        result = await client.authenticate()
        
        assert result is True
        client.auth.authenticate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_check_connection(self, client):
        """Test connection check"""
        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'shop': {'id': 'test_shop'}}
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.check_connection()
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_get_product(self, client):
        """Test getting a single product"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'product': {
                'productId': '12345',
                'productName': 'Test Product',
                'salesPrice': 1000,
                'displayFlag': 1
            }
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.get_product('12345')
        
        assert result['platform_id'] == '12345'
        assert result['title'] == 'Test Product'
        assert result['price'] == '1000'
        assert result['status'] == 'active'
    
    @pytest.mark.asyncio
    async def test_get_products(self, client):
        """Test getting multiple products"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'products': [
                {
                    'productId': '12345',
                    'productName': 'Product 1',
                    'salesPrice': 1000
                },
                {
                    'productId': '67890',
                    'productName': 'Product 2',
                    'salesPrice': 2000
                }
            ]
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        results = await client.get_products(limit=50)
        
        assert len(results) == 2
        assert results[0]['platform_id'] == '12345'
        assert results[1]['platform_id'] == '67890'
    
    @pytest.mark.asyncio
    async def test_create_product(self, client):
        """Test creating a product"""
        # Product data
        product_data = {
            'title': 'New Product',
            'price': '3000',
            'sku': 'NEW-001'
        }
        
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'product': {
                'productId': '99999',
                'productName': 'New Product',
                'salesPrice': 3000
            }
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.create_product(product_data)
        
        assert result['platform_id'] == '99999'
        assert result['title'] == 'New Product'
    
    @pytest.mark.asyncio
    async def test_update_product(self, client):
        """Test updating a product"""
        # Get existing product first
        get_response = Mock()
        get_response.status_code = 200
        get_response.json.return_value = {
            'product': {
                'productId': '12345',
                'productName': 'Old Name',
                'salesPrice': 1000
            }
        }
        
        # Update response
        update_response = Mock()
        update_response.status_code = 200
        update_response.json.return_value = {
            'product': {
                'productId': '12345',
                'productName': 'New Name',
                'salesPrice': 1500
            }
        }
        
        client.client.request = AsyncMock(side_effect=[get_response, update_response])
        
        result = await client.update_product('12345', {'title': 'New Name', 'price': '1500'})
        
        assert result['title'] == 'New Name'
        assert result['price'] == '1500'
    
    @pytest.mark.asyncio
    async def test_delete_product(self, client):
        """Test deleting a product"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': True}
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.delete_product('12345')
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_get_order(self, client):
        """Test getting a single order"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'order': {
                'orderNumber': 'ORD-001',
                'orderStatus': 300,  # 発送待ち
                'amount': {
                    'total': 5000,
                    'tax': 500,
                    'shippingCharge': 600
                }
            }
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.get_order('ORD-001')
        
        assert result['platform_id'] == 'ORD-001'
        assert result['status'] == 'processing'
        assert result['total'] == '5000'
    
    @pytest.mark.asyncio
    async def test_update_order_status(self, client):
        """Test updating order status"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'order': {
                'orderNumber': 'ORD-001',
                'orderStatus': 400  # 発送済み
            }
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.update_order_status('ORD-001', 'shipped')
        
        assert result['status'] == 'shipped'
    
    @pytest.mark.asyncio
    async def test_get_customer(self, client):
        """Test getting a customer"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'member': {
                'memberId': 'CUST-001',
                'email': 'test@example.com',
                'name': {
                    'lastName': '田中',
                    'firstName': '太郎'
                }
            }
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.get_customer('CUST-001')
        
        assert result['platform_id'] == 'CUST-001'
        assert result['email'] == 'test@example.com'
        assert result['last_name'] == '田中'
        assert result['first_name'] == '太郎'
    
    @pytest.mark.asyncio
    async def test_update_inventory(self, client):
        """Test updating inventory"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'quantity': 100,
            'productId': '12345'
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        result = await client.update_inventory('12345', 100)
        
        assert result['product_id'] == '12345'
        assert result['quantity'] == 100
    
    @pytest.mark.asyncio
    async def test_error_handling(self, client):
        """Test error handling"""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            'errors': [
                {
                    'code': 'INVALID_PRODUCT',
                    'message': 'Invalid product ID'
                }
            ]
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        with pytest.raises(RakutenAPIError) as excinfo:
            await client.get_product('invalid')
        
        assert 'Invalid product ID' in str(excinfo.value)
        assert excinfo.value.code == 'INVALID_PRODUCT'
    
    @pytest.mark.asyncio
    async def test_rate_limit_tracking(self, client):
        """Test rate limit tracking"""
        # Mock response with rate limit headers
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '25',
            'X-RateLimit-Reset': '1234567890'
        }
        mock_response.json.return_value = {'product': {}}
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        await client.get_product('12345')
        
        rate_limit = client.get_rate_limit_info()
        assert rate_limit.requests_limit == 30
        assert rate_limit.requests_remaining == 25
        assert rate_limit.reset_time == 1234567890
        assert rate_limit.usage_percentage > 0