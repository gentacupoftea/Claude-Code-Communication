"""
FastAPI dependency injection for Google Analytics.
"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis.asyncio as redis
import logging

from src.google_analytics.client import GoogleAnalyticsClient
from src.google_analytics.cache import CacheLayer
from src.google_analytics.config.settings import settings

# Import authentication dependencies from our improved auth system
from src.auth.dependencies import (
    get_current_user as auth_get_current_user,
    get_current_active_user,
    get_jwt_manager,
    get_api_token_service,
    api_key_header
)
from src.auth.security import InvalidTokenError
from src.auth.models import User

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()

# Global instances
_analytics_client: Optional[GoogleAnalyticsClient] = None
_redis_client: Optional[redis.Redis] = None
_cache_layer: Optional[CacheLayer] = None


async def get_redis_client() -> redis.Redis:
    """Get Redis client instance."""
    global _redis_client
    
    if _redis_client is None:
        redis_config = settings.get_redis_config()
        _redis_client = redis.Redis(**redis_config)
        
        # Test connection
        try:
            await _redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise HTTPException(
                status_code=503,
                detail="Cache service unavailable"
            )
    
    return _redis_client


async def get_cache_layer(
    redis_client: redis.Redis = Depends(get_redis_client)
) -> CacheLayer:
    """Get cache layer instance."""
    global _cache_layer
    
    if _cache_layer is None:
        _cache_layer = CacheLayer(
            redis_client=redis_client,
            ttl=settings.cache_ttl
        )
        logger.info("Cache layer initialized")
    
    return _cache_layer


async def get_analytics_client() -> GoogleAnalyticsClient:
    """Get Google Analytics client instance."""
    global _analytics_client
    
    if _analytics_client is None:
        credentials = settings.get_credentials()
        if not credentials:
            raise HTTPException(
                status_code=500,
                detail="Google Analytics credentials not configured"
            )
        
        _analytics_client = GoogleAnalyticsClient(
            credentials=credentials,
            property_id=settings.ga_property_id
        )
        
        # Test connection
        try:
            await _analytics_client.check_access()
            logger.info("Google Analytics client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize GA client: {e}")
            raise HTTPException(
                status_code=503,
                detail="Google Analytics service unavailable"
            )
    
    return _analytics_client


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    jwt_manager = Depends(get_jwt_manager)
) -> dict:
    """Verify JWT token using improved authentication system."""
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Use our improved JWT verification
        payload = jwt_manager.verify_token(token)
        return payload
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> Optional[str]:
    """Get API key from header."""
    return x_api_key


async def verify_api_key(
    api_key: Optional[str] = Depends(get_api_key),
    api_token_service = Depends(get_api_token_service)
) -> Optional[User]:
    """Verify API key using improved authentication system."""
    if not api_key:
        if settings.api_key_header:
            raise HTTPException(
                status_code=401,
                detail="API key required",
                headers={"WWW-Authenticate": "X-API-Key"}
            )
        return None
    
    # Use our improved API token verification
    token = await api_token_service.verify_token_optimized(api_key)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "X-API-Key"}
        )
    
    return token.user


async def get_current_user(
    # Try JWT auth first, then API key
    user_from_jwt: Optional[User] = Depends(auth_get_current_user),
    user_from_api_key: Optional[User] = Depends(verify_api_key)
) -> User:
    """Get current user from either JWT or API key."""
    # JWT takes precedence
    if user_from_jwt:
        return user_from_jwt
    
    # Fall back to API key
    if user_from_api_key:
        return user_from_api_key
    
    # No valid authentication
    raise HTTPException(
        status_code=401,
        detail="Authentication required"
    )


async def check_permission(
    permission: str,
    user: User = Depends(get_current_user)
) -> None:
    """Check if user has required permission."""
    # Check if user is superuser (has all permissions)
    if user.is_superuser:
        return
    
    # For Google Analytics, we'll implement basic permission checks
    # This can be extended to check against user roles/permissions in the database
    google_analytics_permissions = {
        "read": ["read", "analytics:read", "ga:read"],
        "write": ["write", "analytics:write", "ga:write"],
        "admin": ["admin", "analytics:admin", "ga:admin"]
    }
    
    # Check if user has the required permission
    # This is a simplified check - in production, you'd check against actual user permissions
    if permission in ["read", "analytics:read"] and not user.is_active:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {permission}"
        )


def get_rate_limiter():
    """Get rate limiter instance."""
    # TODO: Implement rate limiting
    async def rate_limit_check(request: Request):
        if not settings.rate_limit_enabled:
            return
        
        # Implement rate limiting logic here
        pass
    
    return rate_limit_check


# Permission dependency factories
def require_read_permission():
    """Require read permission."""
    async def check_read(user: User = Depends(get_current_user)):
        await check_permission("read", user)
    return check_read


def require_write_permission():
    """Require write permission."""
    async def check_write(user: User = Depends(get_current_user)):
        await check_permission("write", user)
    return check_write


def require_admin_permission():
    """Require admin permission."""
    async def check_admin(user: User = Depends(get_current_user)):
        await check_permission("admin", user)
    return check_admin


# Cleanup function for graceful shutdown
async def cleanup_dependencies():
    """Cleanup dependencies on shutdown."""
    global _analytics_client, _redis_client, _cache_layer
    
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")
    
    _analytics_client = None
    _cache_layer = None
    logger.info("Dependencies cleaned up")