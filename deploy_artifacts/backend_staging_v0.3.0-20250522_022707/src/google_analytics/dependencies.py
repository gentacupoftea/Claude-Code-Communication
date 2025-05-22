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
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """Verify JWT token."""
    token = credentials.credentials
    
    # TODO: Implement actual JWT verification
    # For now, just check if token exists
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )
    
    return token


async def get_api_key(
    x_api_key: Optional[str] = Header(None)
) -> Optional[str]:
    """Get API key from header."""
    return x_api_key


async def verify_api_key(
    api_key: Optional[str] = Depends(get_api_key)
) -> None:
    """Verify API key."""
    # TODO: Implement actual API key verification
    if settings.api_key_header and not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required"
        )


async def get_current_user(
    token: str = Depends(verify_token)
) -> Dict[str, Any]:
    """Get current user from token."""
    # TODO: Implement actual user extraction from JWT
    return {
        "user_id": "test_user",
        "email": "test@example.com",
        "permissions": ["read", "write"]
    }


async def check_permission(
    permission: str,
    user: Dict[str, Any] = Depends(get_current_user)
) -> None:
    """Check if user has required permission."""
    if permission not in user.get("permissions", []):
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
    async def check_read(user: Dict[str, Any] = Depends(get_current_user)):
        await check_permission("read", user)
    return check_read


def require_write_permission():
    """Require write permission."""
    async def check_write(user: Dict[str, Any] = Depends(get_current_user)):
        await check_permission("write", user)
    return check_write


def require_admin_permission():
    """Require admin permission."""
    async def check_admin(user: Dict[str, Any] = Depends(get_current_user)):
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