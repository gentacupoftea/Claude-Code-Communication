"""
強化された認証・認可システムの統合テスト
Enhanced Authentication and Authorization System Integration Tests
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import jwt
from datetime import datetime, timedelta
import os
import time
import asyncio

# テスト用のJWT秘密鍵
TEST_JWT_SECRET = "test-secret-key-for-authentication-testing-at-least-32-chars"
TEST_JWT_ALGORITHM = "HS256"


@pytest.fixture
def mock_auth_settings():
    """Mock authentication settings for testing."""
    with patch('src.auth.config.get_auth_settings') as mock:
        settings = MagicMock()
        settings.jwt_secret_key = TEST_JWT_SECRET
        settings.jwt_algorithm = TEST_JWT_ALGORITHM
        settings.access_token_expire_minutes = 15
        settings.refresh_token_expire_minutes = 60 * 24 * 7
        settings.cors_origins = "http://localhost:3000,http://localhost:3001"
        settings.shopify_webhook_secret = "test-shopify-secret"
        settings.stripe_webhook_secret = "test-stripe-secret"
        mock.return_value = settings
        yield settings


@pytest.fixture
def test_user():
    """Create a test user object."""
    user = MagicMock()
    user.id = "test-user-id"
    user.email = "test@example.com"
    user.is_active = True
    user.is_superuser = False
    return user


@pytest.fixture
def test_superuser():
    """Create a test superuser object."""
    user = MagicMock()
    user.id = "test-superuser-id"
    user.email = "admin@example.com"
    user.is_active = True
    user.is_superuser = True
    return user


@pytest.fixture
def expired_token():
    """Create an expired JWT token."""
    payload = {
        "sub": "test-user-id",
        "email": "test@example.com",
        "is_superuser": False,
        "exp": datetime.utcnow() - timedelta(minutes=1),  # Expired 1 minute ago
        "token_type": "access",
        "jti": "test-jti"
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm=TEST_JWT_ALGORITHM)


@pytest.fixture
def valid_token():
    """Create a valid JWT token."""
    payload = {
        "sub": "test-user-id",
        "email": "test@example.com",
        "is_superuser": False,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "token_type": "access",
        "jti": "test-jti"
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm=TEST_JWT_ALGORITHM)


@pytest.fixture
def admin_token():
    """Create a valid admin JWT token."""
    payload = {
        "sub": "admin-user-id",
        "email": "admin@example.com",
        "is_superuser": True,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "token_type": "access",
        "jti": "admin-jti"
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm=TEST_JWT_ALGORITHM)


class TestJWTSecurity:
    """Test JWT security implementation."""
    
    @pytest.mark.asyncio
    async def test_jwt_algorithm_restriction(self):
        """Test that 'none' algorithm is rejected."""
        from src.auth.security import JWTManager as SecureJWTManager
        
        # Should raise error for 'none' algorithm
        with pytest.raises(ValueError, match="Unsupported algorithm"):
            SecureJWTManager(TEST_JWT_SECRET, algorithm="none")
        
        # Should raise error for unsupported algorithm
        with pytest.raises(ValueError, match="Unsupported algorithm"):
            SecureJWTManager(TEST_JWT_SECRET, algorithm="unsupported")
    
    @pytest.mark.asyncio
    async def test_jwt_secret_validation(self):
        """Test JWT secret key strength validation."""
        from src.auth.security import JWTManager as SecureJWTManager
        
        # Should raise error for short secret
        with pytest.raises(ValueError, match="at least 32 characters"):
            SecureJWTManager("short-secret", algorithm="HS256")
        
        # Should raise error for default secret
        with pytest.raises(ValueError, match="Default or weak JWT secret"):
            SecureJWTManager("your-secret-key-here", algorithm="HS256")
    
    @pytest.mark.asyncio
    async def test_jwt_expiration_handling(self):
        """Test proper handling of expired tokens."""
        from src.auth.security import JWTManager as SecureJWTManager, InvalidTokenError as SecureInvalidTokenError
        
        jwt_manager = SecureJWTManager(TEST_JWT_SECRET)
        
        # Create expired token
        expired_payload = {
            "sub": "test-user",
            "exp": datetime.utcnow() - timedelta(minutes=1)
        }
        expired_token = jwt.encode(expired_payload, TEST_JWT_SECRET, algorithm="HS256")
        
        # Should raise appropriate error
        with pytest.raises(SecureInvalidTokenError, match="Token has expired"):
            jwt_manager.verify_token(expired_token)
    
    @pytest.mark.asyncio
    async def test_jwt_jti_generation(self):
        """Test that JTI (JWT ID) is generated for blacklisting."""
        from src.auth.security import JWTManager as SecureJWTManager
        
        jwt_manager = SecureJWTManager(TEST_JWT_SECRET)
        token = jwt_manager.create_access_token({"sub": "test-user"})
        
        # Decode and verify JTI exists
        payload = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])
        assert "jti" in payload
        assert len(payload["jti"]) >= 16


class TestAPITokenSecurity:
    """Test API token security implementation."""
    
    @pytest.mark.asyncio
    async def test_api_token_salted_hashing(self):
        """Test that API tokens are hashed with salt."""
        from src.auth.security import APITokenManager as SecureAPITokenManager
        
        # Generate token
        token_value, token_hash, salt = SecureAPITokenManager.generate_token()
        
        # Verify components
        assert len(token_value) >= 32
        assert len(salt) == 32  # 16 bytes hex = 32 chars
        assert len(token_hash) == 64  # SHA256 hex = 64 chars
        
        # Verify hash can be recreated
        recreated_hash = SecureAPITokenManager.hash_token(token_value, salt)
        assert recreated_hash == token_hash
    
    @pytest.mark.asyncio
    async def test_api_token_timing_attack_protection(self):
        """Test constant-time comparison for API tokens."""
        from src.auth.security import APITokenManager as SecureAPITokenManager
        
        token_value, token_hash, salt = SecureAPITokenManager.generate_token()
        
        # Correct token should verify
        assert SecureAPITokenManager.verify_token_hash(token_value, token_hash, salt)
        
        # Wrong token should not verify
        assert not SecureAPITokenManager.verify_token_hash("wrong-token", token_hash, salt)
        
        # Test timing consistency (basic check)
        start_time = time.time()
        for _ in range(100):
            SecureAPITokenManager.verify_token_hash(token_value, token_hash, salt)
        correct_time = time.time() - start_time
        
        start_time = time.time()
        for _ in range(100):
            SecureAPITokenManager.verify_token_hash("wrong-token", token_hash, salt)
        wrong_time = time.time() - start_time
        
        # Times should be similar (within 20% tolerance)
        assert abs(correct_time - wrong_time) / correct_time < 0.2


class TestRateLimiting:
    """Test rate limiting implementation."""
    
    @pytest.mark.asyncio
    async def test_rate_limit_enforcement(self):
        """Test that rate limits are enforced."""
        from src.auth.security_improvements import RateLimiter, TooManyAttemptsError
        
        limiter = RateLimiter(max_attempts=3, window_seconds=60)
        
        # First 3 attempts should succeed
        for i in range(3):
            limiter.check_rate_limit("test-user")
        
        # 4th attempt should fail
        with pytest.raises(TooManyAttemptsError):
            limiter.check_rate_limit("test-user")
    
    @pytest.mark.asyncio
    async def test_rate_limit_window_reset(self):
        """Test that rate limit window resets after time."""
        from src.auth.security_improvements import RateLimiter
        
        limiter = RateLimiter(max_attempts=2, window_seconds=1)  # 1 second window
        
        # Use up rate limit
        limiter.check_rate_limit("test-user")
        limiter.check_rate_limit("test-user")
        
        # Wait for window to reset
        await asyncio.sleep(1.1)
        
        # Should work again
        limiter.check_rate_limit("test-user")
    
    @pytest.mark.asyncio
    async def test_rate_limit_decorator(self):
        """Test rate limit decorator for auth endpoints."""
        from src.auth.security_improvements import rate_limit_auth, TooManyAttemptsError
        
        call_count = 0
        
        @rate_limit_auth(max_attempts=2, window_seconds=60)
        async def mock_login(email: str, password: str):
            nonlocal call_count
            call_count += 1
            if password != "correct":
                raise ValueError("Invalid password")
            return {"token": "test-token"}
        
        # First 2 attempts should work
        with pytest.raises(ValueError):
            await mock_login(email="test@example.com", password="wrong")
        with pytest.raises(ValueError):
            await mock_login(email="test@example.com", password="wrong")
        
        # 3rd attempt should be rate limited
        with pytest.raises(TooManyAttemptsError):
            await mock_login(email="test@example.com", password="wrong")
        
        assert call_count == 2  # Only 2 calls made it through


class TestMiddlewareIntegration:
    """Test middleware integration and order."""
    
    @pytest.mark.asyncio
    async def test_public_path_exclusion(self):
        """Test that public paths are excluded from auth."""
        from src.auth.middleware_improvements import ProperAuthenticationMiddleware
        from src.auth.security import JWTManager as SecureJWTManager
        from fastapi import FastAPI, Request
        
        app = FastAPI()
        jwt_manager = SecureJWTManager(TEST_JWT_SECRET)
        
        # Add middleware
        app.add_middleware(ProperAuthenticationMiddleware, jwt_manager=jwt_manager)
        
        # Add test endpoints
        @app.get("/health")
        async def health():
            return {"status": "ok"}
        
        @app.get("/api/protected")
        async def protected():
            return {"data": "secret"}
        
        client = TestClient(app)
        
        # Public endpoint should work without auth
        response = client.get("/health")
        assert response.status_code == 200
        
        # Protected endpoint should require auth
        response = client.get("/api/protected")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_middleware_order_headers(self):
        """Test that middleware adds headers in correct order."""
        from src.auth.middleware_improvements import (
            EnhancedSecurityHeadersMiddleware,
            RequestTrackingMiddleware
        )
        from fastapi import FastAPI
        
        app = FastAPI()
        
        # Add middleware in order
        app.add_middleware(EnhancedSecurityHeadersMiddleware)
        app.add_middleware(RequestTrackingMiddleware)
        
        @app.get("/test")
        async def test():
            return {"message": "test"}
        
        client = TestClient(app)
        response = client.get("/test")
        
        # Check security headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert "X-Request-ID" in response.headers
        assert "X-Process-Time" in response.headers


class TestErrorHandling:
    """Test secure error handling."""
    
    @pytest.mark.asyncio
    async def test_no_user_enumeration(self):
        """Test that login errors don't reveal user existence."""
        # This would be tested against actual login endpoint
        # Verify same error for non-existent user and wrong password
        pass
    
    @pytest.mark.asyncio
    async def test_generic_error_messages(self):
        """Test that detailed errors are logged but not exposed."""
        from src.auth.security import JWTManager as SecureJWTManager, InvalidTokenError as SecureInvalidTokenError
        
        jwt_manager = SecureJWTManager(TEST_JWT_SECRET)
        
        # Various invalid tokens should all give generic error
        invalid_tokens = [
            "not.a.token",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.",  # none algorithm
            jwt.encode({"sub": "test"}, "wrong-secret", algorithm="HS256"),  # wrong secret
        ]
        
        for token in invalid_tokens:
            with pytest.raises(SecureInvalidTokenError) as exc:
                jwt_manager.verify_token(token)
            # Error message should be generic
            assert str(exc.value) in ["Invalid token", "Token verification failed"]


class TestComprehensiveScenarios:
    """Test comprehensive authentication scenarios."""
    
    @pytest.mark.asyncio
    async def test_full_authentication_flow(self):
        """Test complete authentication flow from login to API access."""
        # This would test:
        # 1. User registration
        # 2. Email verification
        # 3. Login and token generation
        # 4. Accessing protected resources
        # 5. Token refresh
        # 6. Logout/token blacklisting
        pass
    
    @pytest.mark.asyncio
    async def test_concurrent_authentication(self):
        """Test handling of concurrent authentication requests."""
        # Test that rate limiting works correctly under concurrent load
        pass
    
    @pytest.mark.asyncio
    async def test_token_rotation(self):
        """Test token rotation and refresh scenarios."""
        # Test refresh token usage and access token rotation
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])