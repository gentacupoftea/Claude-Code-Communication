"""
Caching layer for environment variables to improve performance
"""
import json
import logging
from typing import Optional, List, Dict, Any
from functools import wraps
import hashlib
import redis
import os
from datetime import timedelta

logger = logging.getLogger(__name__)


class EnvironmentCache:
    """Cache manager for environment variables"""
    
    def __init__(self):
        self.redis_client = None
        self.cache_enabled = False
        self._init_redis()
    
    def _init_redis(self):
        """Initialize Redis connection if available"""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            redis_password = os.getenv("REDIS_PASSWORD")
            
            self.redis_client = redis.from_url(
                redis_url,
                password=redis_password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            self.redis_client.ping()
            self.cache_enabled = True
            logger.info("Redis cache initialized successfully")
            
        except Exception as e:
            logger.warning(f"Redis cache not available: {e}")
            self.cache_enabled = False
    
    def _make_key(self, prefix: str, *args) -> str:
        """Generate cache key"""
        key_parts = [prefix] + [str(arg) for arg in args]
        key_string = ":".join(key_parts)
        
        # Hash long keys to avoid Redis key length limits
        if len(key_string) > 200:
            key_hash = hashlib.md5(key_string.encode()).hexdigest()
            return f"{prefix}:hash:{key_hash}"
        
        return key_string
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.cache_enabled:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
        
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        if not self.cache_enabled:
            return False
        
        try:
            serialized_value = json.dumps(value, default=str)
            return self.redis_client.setex(key, ttl, serialized_value)
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if not self.cache_enabled:
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.warning(f"Cache delete error: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        if not self.cache_enabled:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache delete pattern error: {e}")
        
        return 0
    
    def get_variables_list(self, organization_id: Optional[str], category: Optional[str]) -> Optional[List[Dict]]:
        """Get cached variables list"""
        key = self._make_key("env_vars", organization_id or "none", category or "all")
        return self.get(key)
    
    def set_variables_list(self, organization_id: Optional[str], category: Optional[str], 
                          variables: List[Dict], ttl: int = 300) -> bool:
        """Cache variables list"""
        key = self._make_key("env_vars", organization_id or "none", category or "all")
        return self.set(key, variables, ttl)
    
    def get_variable(self, organization_id: Optional[str], category: str, key: str) -> Optional[Dict]:
        """Get cached single variable"""
        cache_key = self._make_key("env_var", organization_id or "none", category, key)
        return self.get(cache_key)
    
    def set_variable(self, organization_id: Optional[str], category: str, key: str, 
                    variable: Dict, ttl: int = 600) -> bool:
        """Cache single variable"""
        cache_key = self._make_key("env_var", organization_id or "none", category, key)
        return self.set(cache_key, variable, ttl)
    
    def invalidate_organization(self, organization_id: Optional[str]) -> int:
        """Invalidate all cache entries for an organization"""
        pattern = self._make_key("env_*", organization_id or "none", "*")
        return self.delete_pattern(pattern)
    
    def invalidate_category(self, organization_id: Optional[str], category: str) -> int:
        """Invalidate cache entries for a category"""
        pattern = self._make_key("env_*", organization_id or "none", category, "*")
        return self.delete_pattern(pattern)


# Global cache instance
env_cache = EnvironmentCache()


def cached_result(ttl: int = 300, key_prefix: str = "default"):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not env_cache.cache_enabled:
                return func(*args, **kwargs)
            
            # Generate cache key from function name and arguments
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            
            cache_key = env_cache._make_key(*key_parts)
            
            # Try to get from cache
            cached_value = env_cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            env_cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


def cache_invalidation_decorator(func):
    """Decorator to invalidate cache after data modifications"""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        result = func(self, *args, **kwargs)
        
        # Invalidate relevant cache entries
        try:
            organization_id = getattr(self, 'organization_id', None)
            if hasattr(result, 'category'):
                env_cache.invalidate_category(organization_id, result.category)
            else:
                env_cache.invalidate_organization(organization_id)
        except Exception as e:
            logger.warning(f"Cache invalidation error: {e}")
        
        return result
    
    return wrapper