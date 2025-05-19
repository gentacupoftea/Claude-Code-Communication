"""
Tests for Rakuten Authentication
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import httpx
import time
import json
from datetime import datetime, timedelta

from src.api.rakuten.auth import (
    RakutenAuth,
    RakutenCredentials,
    RakutenToken
)


class TestRakutenToken:
    """Test RakutenToken class"""
    
    def test_token_creation(self):
        """Test token creation"""
        token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
        )
        
        assert token.access_token == 'test_token'
        assert token.token_type == 'Bearer'
        assert token.expires_in == 3600
        assert token.scope == 'rakuten_ichiba'
        assert token.created_at > 0
    
    def test_token_expiration(self):
        """Test token expiration check"""
        # Fresh token
        token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
        )
        
        assert not token.is_expired
        
        # Expired token
        expired_token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            created_at=time.time() - 4000  # Created over an hour ago
        )
        
        assert expired_token.is_expired
    
    def test_token_expires_at(self):
        """Test token expiration time calculation"""
        token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
        )
        
        expected_expiry = datetime.fromtimestamp(token.created_at + 3600)
        assert abs((token.expires_at - expected_expiry).total_seconds()) < 1
    
    def test_token_serialization(self):
        """Test token to/from dict conversion"""
        token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            refresh_token='refresh_token'
        )
        
        # To dict
        token_dict = token.to_dict()
        assert token_dict['access_token'] == 'test_token'
        assert token_dict['refresh_token'] == 'refresh_token'
        assert 'created_at' in token_dict
        
        # From dict
        restored_token = RakutenToken.from_dict(token_dict)
        assert restored_token.access_token == token.access_token
        assert restored_token.refresh_token == token.refresh_token
        assert restored_token.created_at == token.created_at


class TestRakutenAuth:
    """Test RakutenAuth class"""
    
    @pytest.fixture
    def credentials(self):
        """Test credentials"""
        return RakutenCredentials(
            service_secret='test_secret',
            license_key='test_key',
            shop_id='test_shop'
        )
    
    @pytest.fixture
    def auth(self, credentials):
        """Create auth instance"""
        return RakutenAuth(credentials)
    
    @pytest.mark.asyncio
    async def test_authenticate_success(self, auth):
        """Test successful authentication"""
        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'test_access_token',
            'token_type': 'Bearer',
            'expires_in': 3600,
            'scope': 'rakuten_ichiba'
        }
        
        auth.client.post = AsyncMock(return_value=mock_response)
        
        result = await auth.authenticate()
        
        assert result is True
        assert auth.token is not None
        assert auth.token.access_token == 'test_access_token'
    
    @pytest.mark.asyncio
    async def test_authenticate_failure(self, auth):
        """Test authentication failure"""
        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message='Unauthorized',
            request=Mock(),
            response=mock_response
        )
        
        auth.client.post = AsyncMock(return_value=mock_response)
        
        result = await auth.authenticate()
        
        assert result is False
        assert auth.token is None
    
    @pytest.mark.asyncio
    async def test_refresh_token(self, auth):
        """Test token refresh"""
        # Set initial token with refresh token
        auth.token = RakutenToken(
            access_token='old_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            refresh_token='refresh_token'
        )
        
        # Mock refresh response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'new_access_token',
            'token_type': 'Bearer',
            'expires_in': 3600,
            'scope': 'rakuten_ichiba',
            'refresh_token': 'new_refresh_token'
        }
        
        auth.client.post = AsyncMock(return_value=mock_response)
        
        result = await auth.refresh_access_token()
        
        assert result is True
        assert auth.token.access_token == 'new_access_token'
        assert auth.token.refresh_token == 'new_refresh_token'
    
    @pytest.mark.asyncio
    async def test_refresh_without_token(self, auth):
        """Test refresh without refresh token"""
        auth.token = RakutenToken(
            access_token='token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
            # No refresh token
        )
        
        result = await auth.refresh_access_token()
        
        assert result is False
    
    def test_get_auth_header(self, auth):
        """Test getting authorization header"""
        auth.token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
        )
        
        header = auth.get_auth_header()
        
        assert header['Authorization'] == 'Bearer test_token'
    
    def test_get_auth_header_no_token(self, auth):
        """Test getting header without token"""
        auth.token = None
        
        with pytest.raises(ValueError, match='Not authenticated'):
            auth.get_auth_header()
    
    @pytest.mark.asyncio
    async def test_ensure_valid_token_fresh(self, auth):
        """Test ensure_valid_token with fresh token"""
        auth.token = RakutenToken(
            access_token='fresh_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba'
        )
        
        result = await auth.ensure_valid_token()
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_ensure_valid_token_expired_with_refresh(self, auth):
        """Test ensure_valid_token with expired token and refresh"""
        # Set expired token with refresh token
        auth.token = RakutenToken(
            access_token='expired_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            refresh_token='refresh_token',
            created_at=time.time() - 4000  # Expired
        )
        
        # Mock refresh
        auth.refresh_access_token = AsyncMock(return_value=True)
        
        result = await auth.ensure_valid_token()
        
        assert result is True
        auth.refresh_access_token.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_ensure_valid_token_expired_no_refresh(self, auth):
        """Test ensure_valid_token with expired token and no refresh"""
        # Set expired token without refresh token
        auth.token = RakutenToken(
            access_token='expired_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            created_at=time.time() - 4000  # Expired
        )
        
        # Mock authenticate
        auth.authenticate = AsyncMock(return_value=True)
        
        result = await auth.ensure_valid_token()
        
        assert result is True
        auth.authenticate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_save_load_token(self, auth, tmp_path):
        """Test saving and loading token"""
        # Create token
        auth.token = RakutenToken(
            access_token='test_token',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            refresh_token='refresh_token'
        )
        
        # Save token
        token_file = tmp_path / 'token.json'
        auth.save_token(str(token_file))
        
        assert token_file.exists()
        
        # Load token
        new_auth = RakutenAuth(auth.credentials)
        result = new_auth.load_token(str(token_file))
        
        assert result is True
        assert new_auth.token is not None
        assert new_auth.token.access_token == 'test_token'
        assert new_auth.token.refresh_token == 'refresh_token'
    
    @pytest.mark.asyncio
    async def test_close(self, auth):
        """Test closing auth client"""
        auth.client.aclose = AsyncMock()
        
        await auth.close()
        
        auth.client.aclose.assert_called_once()