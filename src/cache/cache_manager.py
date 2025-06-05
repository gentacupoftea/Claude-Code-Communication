import time
import json
import asyncio
import hashlib
import logging
from typing import Any, Dict, Optional, List, Union
from datetime import datetime, timedelta


class CacheManager:
    """
    Base cache manager class that defines the standard caching interface.
    This class provides a simple Redis-based implementation.
    """
    
    def __init__(self, redis_client, ttl: int = 3600):
        """
        Initialize the CacheManager.
        
        Args:
            redis_client: The Redis client instance.
            ttl: Default TTL for cache entries in seconds.
        """
        self.redis_client = redis_client
        self.ttl = ttl
        self.hits = 0
        self.misses = 0
    
    def get(self, key: str, namespace: str = "") -> Any:
        """
        Get a value from the cache.
        
        Args:
            key: The cache key.
            namespace: Optional namespace for the key.
            
        Returns:
            The cached value or None if not found.
        """
        full_key = self._get_full_key(key, namespace)
        redis_value = self.redis_client.get(full_key)
        
        if redis_value is not None:
            try:
                data = json.loads(redis_value)
                self.hits += 1
                return data.get("value")
            except json.JSONDecodeError:
                pass
        
        self.misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None, namespace: str = "") -> bool:
        """
        Set a value in the cache.
        
        Args:
            key: The cache key.
            value: The value to cache.
            ttl: Optional TTL override in seconds.
            namespace: Optional namespace for the key.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        full_key = self._get_full_key(key, namespace)
        data = {
            "value": value,
            "timestamp": time.time()
        }
        
        try:
            return self.redis_client.set(
                full_key,
                json.dumps(data),
                ex=ttl or self.ttl
            )
        except (TypeError, json.JSONDecodeError):
            return False
    
    def invalidate(self, key: str, namespace: str = "") -> None:
        """
        Invalidate a specific cache entry.
        
        Args:
            key: The cache key to invalidate.
            namespace: Optional namespace for the key.
        """
        full_key = self._get_full_key(key, namespace)
        self.redis_client.delete(full_key)
    
    def invalidate_pattern(self, pattern: str, namespace: str = "") -> None:
        """
        Invalidate all cache entries matching a pattern.
        
        Args:
            pattern: The pattern to match against keys.
            namespace: Optional namespace prefix.
        """
        ns_prefix = f"{namespace}:" if namespace else ""
        redis_pattern = f"{ns_prefix}{pattern}"
        
        for key in self.redis_client.scan_iter(f"{redis_pattern}"):
            self.redis_client.delete(key)
    
    def invalidate_all(self) -> None:
        """Invalidate all cache entries."""
        self.redis_client.flushdb()
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache performance statistics.
        
        Returns:
            Dict containing cache statistics.
        """
        total_requests = self.hits + self.misses
        hit_rate = self.get_hit_rate()
        
        return {
            "total_requests": total_requests,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate
        }
    
    def get_hit_rate(self) -> float:
        """
        Calculate the cache hit rate.
        
        Returns:
            The hit rate as a float between 0 and 1.
        """
        total_requests = self.hits + self.misses
        if total_requests == 0:
            return 0
        return self.hits / total_requests
        
    def scan_pattern(self, pattern: str) -> list:
        """
        Scan the cache for keys matching a pattern.
        
        Args:
            pattern: The pattern to match keys against.
            
        Returns:
            List of matching keys.
        """
        result = []
        try:
            for key in self.redis_client.scan_iter(pattern):
                # Convert bytes to str if needed
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                result.append(key)
        except Exception as e:
            # Log the error but don't crash
            print(f"Error scanning Redis: {e}")
        
        return result
    
    def _get_full_key(self, key: str, namespace: str = "") -> str:
        """
        Generate a full cache key by combining namespace and key.
        
        Args:
            key: The base key.
            namespace: Optional namespace.
            
        Returns:
            The full cache key.
        """
        if namespace:
            return f"{namespace}:{key}"
        return key
    
    # Async methods for better Shopify API integration
    async def aget(self, key: str, namespace: str = "") -> Any:
        """Async version of get method"""
        return self.get(key, namespace)
    
    async def aset(self, key: str, value: Any, ttl: Optional[int] = None, namespace: str = "") -> bool:
        """Async version of set method"""
        return self.set(key, value, ttl, namespace)
    
    async def adelete(self, key: str, namespace: str = "") -> bool:
        """Async version of delete method"""
        full_key = self._get_full_key(key, namespace)
        try:
            result = self.redis_client.delete(full_key)
            return result > 0
        except Exception as e:
            logging.error(f"Cache delete error: {e}")
            return False
    
    async def adelete_pattern(self, pattern: str, namespace: str = "") -> int:
        """Async version of delete pattern method"""
        ns_prefix = f"{namespace}:" if namespace else ""
        redis_pattern = f"{ns_prefix}{pattern}"
        
        count = 0
        try:
            for key in self.redis_client.scan_iter(redis_pattern):
                if self.redis_client.delete(key):
                    count += 1
        except Exception as e:
            logging.error(f"Cache delete pattern error: {e}")
        
        return count
    
    def build_cache_key(self, *parts: Union[str, int, dict]) -> str:
        """Build a consistent cache key from multiple parts"""
        key_parts = []
        
        for part in parts:
            if isinstance(part, dict):
                # Sort dict keys for consistent hashing
                sorted_items = sorted(part.items())
                part_str = json.dumps(sorted_items, sort_keys=True)
                # Hash long strings to keep keys reasonable
                if len(part_str) > 100:
                    part_str = hashlib.md5(part_str.encode()).hexdigest()
                key_parts.append(part_str)
            else:
                key_parts.append(str(part))
        
        return ':'.join(key_parts)