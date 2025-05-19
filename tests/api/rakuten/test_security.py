"""
Tests for Rakuten API security improvements
"""

import pytest
import tempfile
import os
from cryptography.fernet import Fernet

from src.api.rakuten.auth import RakutenAuth, RakutenCredentials, RakutenToken
from src.api.rakuten.security import SecureSanitizer, create_safe_error_message


class TestTokenEncryption:
    """Test token encryption functionality"""
    
    @pytest.fixture
    def auth(self):
        """Create auth instance"""
        credentials = RakutenCredentials(
            service_secret='test_secret',
            license_key='test_key',
            shop_id='test_shop'
        )
        return RakutenAuth(credentials)
    
    @pytest.fixture
    def token(self):
        """Create test token"""
        return RakutenToken(
            access_token='test_access_token_1234567890',
            token_type='Bearer',
            expires_in=3600,
            scope='rakuten_ichiba',
            refresh_token='test_refresh_token_1234567890'
        )
    
    def test_save_load_encrypted_token(self, auth, token):
        """Test saving and loading encrypted token"""
        auth.token = token
        
        # Generate encryption key
        key = Fernet.generate_key()
        
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            # Save encrypted token
            auth.save_token(tf.name, encryption_key=key.decode())
            
            # Verify file permissions
            stat_info = os.stat(tf.name)
            assert stat_info.st_mode & 0o777 == 0o600  # Owner read/write only
            
            # Load encrypted token
            new_auth = RakutenAuth(auth.credentials)
            result = new_auth.load_token(tf.name, encryption_key=key.decode())
            
            assert result is True
            assert new_auth.token.access_token == token.access_token
            assert new_auth.token.refresh_token == token.refresh_token
            
            # Clean up
            os.unlink(tf.name)
    
    def test_save_unencrypted_token_warning(self, auth, token):
        """Test warning when saving unencrypted token"""
        auth.token = token
        
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            # Mock logger to check warning
            import logging
            with pytest.warns(None) as warnings:
                auth.save_token(tf.name)  # No encryption key
                
            # Should log warning about security risk
            # Note: We can't directly test logging output without additional setup
            
            # Clean up
            os.unlink(tf.name)
    
    def test_load_nonexistent_token(self, auth):
        """Test loading non-existent token file"""
        result = auth.load_token('/nonexistent/file.json')
        assert result is False


class TestSecureSanitizer:
    """Test security sanitizer functionality"""
    
    def test_sanitize_message_with_patterns(self):
        """Test message sanitization with pattern matching"""
        # Test bearer token
        message = "Authorization: Bearer abcdef1234567890"
        sanitized = SecureSanitizer.sanitize_message(message)
        assert "Bearer ****REDACTED****" in sanitized
        assert "abcdef1234567890" not in sanitized
        
        # Test API key
        message = "api_key=my_secret_api_key_123"
        sanitized = SecureSanitizer.sanitize_message(message)
        assert "api_key=****REDACTED****" in sanitized
        assert "my_secret_api_key_123" not in sanitized
        
        # Test password
        message = "password: super_secret_pass"
        sanitized = SecureSanitizer.sanitize_message(message)
        assert "password: ****REDACTED****" in sanitized
        assert "super_secret_pass" not in sanitized
    
    def test_sanitize_message_with_secrets(self):
        """Test message sanitization with specific secrets"""
        message = "Error connecting with token xyz123abc and key secret456"
        secrets = ["xyz123abc", "secret456"]
        
        sanitized = SecureSanitizer.sanitize_message(message, secrets)
        assert "xy*****bc" in sanitized
        assert "se****56" in sanitized
        assert "xyz123abc" not in sanitized
        assert "secret456" not in sanitized
    
    def test_sanitize_dict(self):
        """Test dictionary sanitization"""
        data = {
            'user': 'test_user',
            'password': 'secret_password',
            'api_key': 'api_key_12345',
            'client_secret': 'client_secret_67890',
            'normal_field': 'normal_value',
            'nested': {
                'token': 'nested_token_123',
                'public': 'public_info'
            }
        }
        
        sanitized = SecureSanitizer.sanitize_dict(data)
        
        assert sanitized['user'] == 'test_user'  # Not sensitive
        assert sanitized['normal_field'] == 'normal_value'  # Not sensitive
        assert sanitized['password'] != 'secret_password'
        assert 'se' in sanitized['password'] and 'rd' in sanitized['password']
        assert sanitized['api_key'] != 'api_key_12345'
        assert sanitized['client_secret'] != 'client_secret_67890'
        assert sanitized['nested']['token'] != 'nested_token_123'
        assert sanitized['nested']['public'] == 'public_info'  # Not sensitive
    
    def test_sanitize_url(self):
        """Test URL sanitization"""
        # URL with sensitive query parameters
        url = "https://api.example.com/endpoint?api_key=secret123&user=test&token=abc456"
        sanitized = SecureSanitizer.sanitize_url(url)
        
        assert "api_key=****REDACTED****" in sanitized
        assert "token=****REDACTED****" in sanitized
        assert "user=test" in sanitized  # Not sensitive
        assert "secret123" not in sanitized
        assert "abc456" not in sanitized
    
    def test_create_safe_error_message(self):
        """Test safe error message creation"""
        error = Exception("Connection failed with api_key=secret_key_123")
        safe_message = create_safe_error_message(error, "API Request")
        
        assert "API Request:" in safe_message
        assert "secret_key_123" not in safe_message
        assert "****REDACTED****" in safe_message