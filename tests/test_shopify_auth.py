"""
Tests for Shopify Authentication module
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from src.shopify.auth import ShopifyAuth, OAuthConfig, InvalidShopError, OAuthVerificationError


@pytest.fixture
def oauth_config():
    return OAuthConfig(
        client_id="test_client_id",
        client_secret="test_client_secret",
        redirect_uri="https://test.com/callback",
        scopes=["read_products", "write_products"]
    )


@pytest.fixture
def shopify_auth(oauth_config):
    return ShopifyAuth(oauth_config, encryption_key="test_key_for_testing_purposes_only")


class TestShopifyAuth:
    
    def test_validate_shop_domain_valid(self, shopify_auth):
        """Test valid shop domain validation"""
        assert shopify_auth.validate_shop_domain("test-shop") == "test-shop"
        assert shopify_auth.validate_shop_domain("test-shop.myshopify.com") == "test-shop"
        assert shopify_auth.validate_shop_domain("https://test-shop.myshopify.com") == "test-shop"
    
    def test_validate_shop_domain_invalid(self, shopify_auth):
        """Test invalid shop domain validation"""
        with pytest.raises(InvalidShopError):
            shopify_auth.validate_shop_domain("")
        
        with pytest.raises(InvalidShopError):
            shopify_auth.validate_shop_domain("a")  # Too short
        
        with pytest.raises(InvalidShopError):
            shopify_auth.validate_shop_domain("-invalid")  # Starts with hyphen
    
    def test_generate_oauth_url(self, shopify_auth):
        """Test OAuth URL generation"""
        oauth_url, state = shopify_auth.generate_oauth_url("test-shop")
        
        assert "test-shop.myshopify.com" in oauth_url
        assert "client_id=test_client_id" in oauth_url
        assert f"state={state}" in oauth_url
        assert "scope=read_products%2Cwrite_products" in oauth_url
    
    def test_verify_oauth_callback_success(self, shopify_auth):
        """Test successful OAuth callback verification"""
        # First generate OAuth URL to create state
        oauth_url, state = shopify_auth.generate_oauth_url("test-shop")
        
        # Verify the callback
        result = shopify_auth.verify_oauth_callback(
            shop="test-shop",
            code="test_code",
            state=state
        )
        
        assert result is True
    
    def test_verify_oauth_callback_invalid_state(self, shopify_auth):
        """Test OAuth callback with invalid state"""
        with pytest.raises(OAuthVerificationError):
            shopify_auth.verify_oauth_callback(
                shop="test-shop",
                code="test_code",
                state="invalid_state"
            )
    
    def test_verify_oauth_callback_expired_state(self, shopify_auth):
        """Test OAuth callback with expired state"""
        # Create an expired state manually
        from src.shopify.auth import OAuthState
        expired_time = datetime.utcnow() - timedelta(minutes=15)
        expired_state = OAuthState(
            state="expired_state",
            shop="test-shop",
            timestamp=expired_time
        )
        shopify_auth._oauth_states["expired_state"] = expired_state
        
        with pytest.raises(OAuthVerificationError):
            shopify_auth.verify_oauth_callback(
                shop="test-shop",
                code="test_code",
                state="expired_state"
            )
    
    def test_verify_hmac(self, shopify_auth):
        """Test HMAC verification"""
        data = "code=test_code&shop=test-shop&state=test_state&timestamp=1234567890"
        
        # Calculate expected HMAC
        import hmac
        import hashlib
        expected_hmac = hmac.new(
            "test_client_secret".encode('utf-8'),
            data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        result = shopify_auth.verify_hmac(data, expected_hmac)
        assert result is True
        
        # Test with invalid HMAC
        result = shopify_auth.verify_hmac(data, "invalid_hmac")
        assert result is False
    
    def test_cleanup_expired_states(self, shopify_auth):
        """Test cleanup of expired OAuth states"""
        # Add some states
        oauth_url1, state1 = shopify_auth.generate_oauth_url("shop1")
        oauth_url2, state2 = shopify_auth.generate_oauth_url("shop2")
        
        # Manually expire one state
        expired_time = datetime.utcnow() - timedelta(minutes=15)
        shopify_auth._oauth_states[state1].timestamp = expired_time
        
        assert len(shopify_auth._oauth_states) == 2
        
        # Trigger cleanup
        shopify_auth._cleanup_expired_states()
        
        assert len(shopify_auth._oauth_states) == 1
        assert state2 in shopify_auth._oauth_states
        assert state1 not in shopify_auth._oauth_states


@pytest.mark.asyncio
class TestShopifyAuthAsync:
    
    async def test_exchange_code_for_token_success(self, shopify_auth):
        """Test successful token exchange"""
        mock_response_data = {
            "access_token": "test_access_token",
            "scope": "read_products,write_products"
        }
        
        mock_shop_info = {
            "id": 12345,
            "name": "Test Shop",
            "email": "test@shop.com",
            "currency": "USD",
            "iana_timezone": "America/New_York"
        }
        
        with patch('aiohttp.ClientSession') as mock_session:
            # Mock token exchange response
            mock_session.return_value.__aenter__.return_value.post.return_value.__aenter__.return_value.status = 200
            mock_session.return_value.__aenter__.return_value.post.return_value.__aenter__.return_value.json.return_value = mock_response_data
            
            # Mock shop info response
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value.status = 200
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value.json.return_value = {"shop": mock_shop_info}
            
            store_connection = await shopify_auth.exchange_code_for_token("test-shop", "test_code")
            
            assert store_connection.shop_domain == "test-shop"
            assert store_connection.access_token == "test_access_token"
            assert store_connection.store_name == "Test Shop"
            assert store_connection.currency == "USD"
    
    async def test_exchange_code_for_token_failure(self, shopify_auth):
        """Test failed token exchange"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.post.return_value.__aenter__.return_value.status = 400
            mock_session.return_value.__aenter__.return_value.post.return_value.__aenter__.return_value.text.return_value = "Invalid request"
            
            with pytest.raises(OAuthVerificationError):
                await shopify_auth.exchange_code_for_token("test-shop", "invalid_code")