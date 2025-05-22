"""Analytics cache system for performance optimization."""

import time
import json
import asyncio
from typing import Any, Optional, Dict
from collections import OrderedDict
from threading import Lock
import logging
import pickle
import hashlib

logger = logging.getLogger(__name__)


class AnalyticsCache:
    """In-memory cache with TTL and LRU eviction for analytics data."""
    
    def __init__(self, ttl: int = 300, max_size: int = 100):
        """Initialize cache with TTL and max size.
        
        Args:
            ttl: Time to live in seconds (default: 5 minutes)
            max_size: Maximum number of entries (default: 100)
        """
        self.ttl = ttl
        self.max_size = max_size
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = Lock()
        self._async_lock = asyncio.Lock()
        
    def _is_expired(self, entry: Dict[str, Any]) -> bool:
        """Check if cache entry is expired."""
        return time.time() > entry['expires_at']
    
    def _evict_lru(self):
        """Evict least recently used entry if cache is full."""
        if len(self._cache) >= self.max_size:
            # Remove the least recently used item (first item in OrderedDict)
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.debug(f"Evicted LRU cache entry: {oldest_key}")
    
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache (sync version)."""
        with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            
            # Check if expired
            if self._is_expired(entry):
                del self._cache[key]
                logger.debug(f"Cache expired for key: {key}")
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            
            logger.debug(f"Cache hit for key: {key}")
            return entry['data']
    
    async def get_async(self, key: str) -> Optional[Any]:
        """Get item from cache (async version)."""
        async with self._async_lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            
            # Check if expired
            if self._is_expired(entry):
                del self._cache[key]
                logger.debug(f"Cache expired for key: {key}")
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            
            logger.debug(f"Cache hit for key: {key}")
            return entry['data']
    
    def set(self, key: str, data: Any) -> None:
        """Set item in cache (sync version)."""
        with self._lock:
            # Evict LRU if needed
            self._evict_lru()
            
            # Add new entry
            self._cache[key] = {
                'data': data,
                'expires_at': time.time() + self.ttl,
                'created_at': time.time()
            }
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            
            logger.debug(f"Cache set for key: {key}")
    
    async def set_async(self, key: str, data: Any) -> None:
        """Set item in cache (async version)."""
        async with self._async_lock:
            # Evict LRU if needed
            self._evict_lru()
            
            # Add new entry
            self._cache[key] = {
                'data': data,
                'expires_at': time.time() + self.ttl,
                'created_at': time.time()
            }
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            
            logger.debug(f"Cache set for key: {key}")
    
    def delete(self, key: str) -> bool:
        """Delete item from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"Cache deleted for key: {key}")
                return True
            return False
    
    def clear(self) -> None:
        """Clear entire cache."""
        with self._lock:
            self._cache.clear()
            logger.info("Cache cleared")
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count of removed items."""
        with self._lock:
            expired_keys = []
            current_time = time.time()
            
            for key, entry in self._cache.items():
                if current_time > entry['expires_at']:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
            
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
            
            return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total_entries = len(self._cache)
            expired_count = sum(1 for entry in self._cache.values() if self._is_expired(entry))
            
            # Calculate average age
            if total_entries > 0:
                ages = [time.time() - entry['created_at'] for entry in self._cache.values()]
                avg_age = sum(ages) / len(ages)
            else:
                avg_age = 0
            
            return {
                'total_entries': total_entries,
                'max_size': self.max_size,
                'expired_entries': expired_count,
                'active_entries': total_entries - expired_count,
                'average_age_seconds': round(avg_age, 2),
                'ttl_seconds': self.ttl
            }
    
    def close(self) -> None:
        """Clean up cache resources."""
        self.clear()
        logger.info("Cache closed")


class DistributedCache(AnalyticsCache):
    """Distributed cache implementation for multi-instance deployments."""
    
    def __init__(self, ttl: int = 300, max_size: int = 100, redis_client=None):
        """Initialize distributed cache.
        
        Args:
            ttl: Time to live in seconds
            max_size: Maximum number of entries
            redis_client: Redis client instance (optional)
        """
        super().__init__(ttl, max_size)
        self.redis_client = redis_client
        self.key_prefix = "analytics:cache:"
    
    def _make_redis_key(self, key: str) -> str:
        """Create Redis key with prefix."""
        return f"{self.key_prefix}{key}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get from distributed cache with fallback to local."""
        # Try Redis first if available
        if self.redis_client:
            try:
                redis_key = self._make_redis_key(key)
                redis_value = self.redis_client.get(redis_key)
                
                if redis_value:
                    data = pickle.loads(redis_value)
                    logger.debug(f"Redis cache hit for key: {key}")
                    
                    # Update local cache
                    super().set(key, data)
                    return data
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")
        
        # Fall back to local cache
        return super().get(key)
    
    def set(self, key: str, data: Any) -> None:
        """Set in both distributed and local cache."""
        # Set in local cache
        super().set(key, data)
        
        # Set in Redis if available
        if self.redis_client:
            try:
                redis_key = self._make_redis_key(key)
                redis_value = pickle.dumps(data)
                self.redis_client.setex(redis_key, self.ttl, redis_value)
                logger.debug(f"Redis cache set for key: {key}")
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")
    
    def delete(self, key: str) -> bool:
        """Delete from both distributed and local cache."""
        # Delete from local
        local_result = super().delete(key)
        
        # Delete from Redis if available
        if self.redis_client:
            try:
                redis_key = self._make_redis_key(key)
                redis_result = self.redis_client.delete(redis_key)
                logger.debug(f"Redis cache deleted for key: {key}")
                return local_result or bool(redis_result)
            except Exception as e:
                logger.warning(f"Redis delete failed: {e}")
        
        return local_result
    
    def clear(self) -> None:
        """Clear both distributed and local cache."""
        # Clear local
        super().clear()
        
        # Clear Redis if available
        if self.redis_client:
            try:
                pattern = f"{self.key_prefix}*"
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
                    logger.info(f"Cleared {len(keys)} Redis cache entries")
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")


class CacheManager:
    """Manage multiple cache instances for different data types."""
    
    def __init__(self, default_ttl: int = 300, default_max_size: int = 100):
        """Initialize cache manager.
        
        Args:
            default_ttl: Default TTL for new caches
            default_max_size: Default max size for new caches
        """
        self.default_ttl = default_ttl
        self.default_max_size = default_max_size
        self.caches: Dict[str, AnalyticsCache] = {}
        self._lock = Lock()
    
    def get_cache(self, name: str) -> AnalyticsCache:
        """Get or create a named cache instance."""
        with self._lock:
            if name not in self.caches:
                self.caches[name] = AnalyticsCache(
                    ttl=self.default_ttl,
                    max_size=self.default_max_size
                )
                logger.info(f"Created new cache: {name}")
            
            return self.caches[name]
    
    def clear_all(self) -> None:
        """Clear all caches."""
        with self._lock:
            for name, cache in self.caches.items():
                cache.clear()
                logger.info(f"Cleared cache: {name}")
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all caches."""
        with self._lock:
            stats = {}
            for name, cache in self.caches.items():
                stats[name] = cache.get_stats()
            return stats
    
    def cleanup_all_expired(self) -> Dict[str, int]:
        """Clean up expired entries in all caches."""
        with self._lock:
            results = {}
            for name, cache in self.caches.items():
                results[name] = cache.cleanup_expired()
            return results


# Global cache manager instance
cache_manager = CacheManager()


def get_analytics_cache(name: str = "default") -> AnalyticsCache:
    """Get a named analytics cache instance."""
    return cache_manager.get_cache(name)