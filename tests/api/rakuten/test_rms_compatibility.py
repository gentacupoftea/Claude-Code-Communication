"""
Tests for RMS API compatibility improvements
"""

import pytest
from unittest.mock import Mock, AsyncMock

from src.api.rakuten.client import RakutenAPIClient, RakutenAPIError
from src.api.rakuten.rms_endpoints import RMSEndpoints, APIType
from src.api.rakuten.rms_errors import RMSErrorCodes, RMSErrorHandler
from src.api.rakuten.models.category import RakutenCategory


class TestRMSEndpoints:
    """Test RMS endpoint management"""
    
    def test_get_endpoint(self):
        """Test getting endpoint configuration"""
        config = RMSEndpoints.get_endpoint("get_product")
        assert config.path == "item/get"
        assert config.version == "es/2.0"
        assert config.method == "GET"
        
    def test_build_url(self):
        """Test building endpoint URL"""
        url = RMSEndpoints.build_url("get_product")
        assert url == "/es/2.0/item/get"
        
        # Test with different version
        url = RMSEndpoints.build_url("get_inventory")
        assert url == "/es/1.0/inventory/getInventory"
        
    def test_unknown_endpoint(self):
        """Test error for unknown endpoint"""
        with pytest.raises(KeyError):
            RMSEndpoints.get_endpoint("unknown_endpoint")
    
    def test_api_versions(self):
        """Test API version mapping"""
        assert RMSEndpoints.get_version(APIType.PRODUCT) == "es/2.0"
        assert RMSEndpoints.get_version(APIType.INVENTORY) == "es/1.0"
        assert RMSEndpoints.get_version(APIType.CATEGORY) == "es/1.0"


class TestRMSErrorHandling:
    """Test RMS error code handling"""
    
    def test_error_message_mapping(self):
        """Test error code to message mapping"""
        message = RMSErrorCodes.get_error_message("C01-001")
        assert message == "認証エラー"
        
        message = RMSErrorCodes.get_error_message("E01-001")
        assert message == "必須パラメータ不足"
        
        # Unknown error
        message = RMSErrorCodes.get_error_message("XXX-999")
        assert "不明なエラー" in message
    
    def test_error_category_detection(self):
        """Test error category detection"""
        assert RMSErrorCodes.is_auth_error("C01-001")
        assert RMSErrorCodes.is_auth_error("C01-003")
        assert not RMSErrorCodes.is_auth_error("E01-001")
        
        assert RMSErrorCodes.is_rate_limit_error("C03-001")
        assert not RMSErrorCodes.is_rate_limit_error("C01-001")
    
    def test_retryable_errors(self):
        """Test retryable error detection"""
        assert RMSErrorCodes.is_retryable("N00-001")  # Temporary system error
        assert RMSErrorCodes.is_retryable("C03-001")  # Rate limit
        assert not RMSErrorCodes.is_retryable("E01-001")  # Missing parameter
        assert not RMSErrorCodes.is_retryable("C01-001")  # Auth error
    
    def test_error_handler(self):
        """Test error handler response"""
        context = {
            "status_code": 429,
            "endpoint": "/es/2.0/item/get",
            "method": "GET"
        }
        
        response = RMSErrorHandler.handle_error("C03-001", "Rate limit exceeded", context)
        
        assert response["code"] == "C03-001"
        assert response["is_retryable"] is True
        assert "recommendation" in response
        assert "retry_after" in response


class TestRMSCompatibleClient:
    """Test RMS-compatible client implementation"""
    
    @pytest.fixture
    async def client(self):
        """Create test client"""
        credentials = {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop'
        }
        client = RakutenAPIClient(credentials)
        # Mock auth
        client.auth = Mock()
        client.auth.ensure_valid_token = AsyncMock(return_value=True)
        client.auth.get_auth_header = Mock(return_value={'Authorization': 'Bearer test_token'})
        return client
    
    @pytest.mark.asyncio
    async def test_rms_endpoint_usage(self, client):
        """Test that client uses RMS endpoints"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'item': {'itemId': '12345'}}
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        await client.get_product('12345')
        
        # Verify correct endpoint was called
        client.client.request.assert_called_once()
        call_args = client.client.request.call_args
        assert call_args[1]['url'] == "/es/2.0/item/get"
        assert call_args[1]['params']['itemId'] == '12345'
    
    @pytest.mark.asyncio
    async def test_rms_error_handling(self, client):
        """Test RMS error handling"""
        # Mock error response
        error_response = Mock()
        error_response.status_code = 429
        error_response.json.return_value = {
            'error': {
                'code': 'C03-001',
                'message': 'Too many requests'
            }
        }
        error_response.headers = {'X-Request-Id': 'test-123'}
        
        client.client.request = AsyncMock(return_value=error_response)
        
        with pytest.raises(RakutenAPIError) as exc_info:
            await client.get_product('12345')
        
        error = exc_info.value
        assert error.code == 'C03-001'
        assert hasattr(error, 'is_retryable')
        assert error.is_retryable is True
        assert hasattr(error, 'error_category')
        assert error.error_category == 'C03'


class TestCategoryAPI:
    """Test category API implementation"""
    
    @pytest.fixture
    async def client(self):
        """Create test client"""
        credentials = {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop'
        }
        client = RakutenAPIClient(credentials)
        # Mock auth
        client.auth = Mock()
        client.auth.ensure_valid_token = AsyncMock(return_value=True)
        client.auth.get_auth_header = Mock(return_value={'Authorization': 'Bearer test_token'})
        return client
    
    @pytest.mark.asyncio
    async def test_get_categories(self, client):
        """Test getting categories"""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'categories': [
                {
                    'categoryId': 'CAT001',
                    'categoryName': 'Electronics',
                    'categoryLevel': 1,
                    'children': [
                        {
                            'categoryId': 'CAT001-01',
                            'categoryName': 'Computers',
                            'categoryLevel': 2,
                            'parentCategoryId': 'CAT001'
                        }
                    ]
                }
            ]
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        categories = await client.get_categories()
        
        assert len(categories) == 1
        assert categories[0]['platform_id'] == 'CAT001'
        assert categories[0]['name'] == 'Electronics'
        assert len(categories[0]['children']) == 1
        assert categories[0]['children'][0]['platform_id'] == 'CAT001-01'
    
    @pytest.mark.asyncio
    async def test_get_category(self, client):
        """Test getting single category"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'categoryId': 'CAT001',
            'categoryName': 'Electronics',
            'categoryLevel': 1,
            'productCount': 100
        }
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        category = await client.get_category('CAT001')
        
        assert category['platform_id'] == 'CAT001'
        assert category['name'] == 'Electronics'
        assert category['product_count'] == 100


class TestCategoryModel:
    """Test category model"""
    
    def test_category_creation(self):
        """Test creating category"""
        category = RakutenCategory(
            category_id='CAT001',
            category_name='Test Category',
            category_level=1
        )
        
        assert category.category_id == 'CAT001'
        assert category.category_name == 'Test Category'
        assert category.category_level == 1
        assert category.is_active is True
    
    def test_category_hierarchy(self):
        """Test category hierarchy"""
        parent = RakutenCategory(
            category_id='CAT001',
            category_name='Parent',
            category_level=1
        )
        
        child = RakutenCategory(
            category_id='CAT001-01',
            category_name='Child',
            category_level=2
        )
        
        parent.add_child(child)
        
        assert len(parent.children) == 1
        assert child.parent_category_id == 'CAT001'
        assert child.category_level == 2
        
        # Test finding child
        found = parent.get_child_by_id('CAT001-01')
        assert found is not None
        assert found.category_id == 'CAT001-01'
    
    def test_category_format_conversion(self):
        """Test format conversion"""
        data = {
            'categoryId': 'CAT001',
            'categoryName': 'Test Category',
            'categoryLevel': 1,
            'isActive': True,
            'seoTitle': 'Test SEO Title'
        }
        
        category = RakutenCategory.from_platform_format(data)
        common_format = category.to_common_format()
        
        assert common_format['platform_id'] == 'CAT001'
        assert common_format['name'] == 'Test Category'
        assert common_format['seo']['title'] == 'Test SEO Title'