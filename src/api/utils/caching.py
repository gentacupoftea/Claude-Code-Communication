#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import logging
import os
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, Optional, Tuple, Union

logger = logging.getLogger(__name__)

class CacheManager:
    """Manages caching for API responses."""
    
    def __init__(self, cache_dir: str = ".cache", default_ttl: int = 3600):
        """
        Initialize the cache manager.
        
        Args:
            cache_dir: Directory to store cache files
            default_ttl: Default time-to-live for cache entries in seconds
        """
        self.cache_dir = cache_dir
        self.default_ttl = default_ttl
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
    
    def _get_cache_key(self, prefix: str, key_parts: Tuple) -> str:
        """
        Generate a cache key from the given parts.
        
        Args:
            prefix: Cache key prefix
            key_parts: Tuple of values to include in the cache key
        
        Returns:
            Cache key string
        """
        # Convert key parts to strings and join with underscores
        key_str = "_".join(str(part).replace("/", "_").replace(":", "_") for part in key_parts if part)
        return f"{prefix}_{key_str}"
    
    def _get_cache_path(self, cache_key: str) -> str:
        """
        Get the file path for a cache key.
        
        Args:
            cache_key: Cache key
        
        Returns:
            File path for the cache
        """
        return os.path.join(self.cache_dir, f"{cache_key}.json")
    
    def get(self, prefix: str, key_parts: Tuple, ttl: Optional[int] = None) -> Optional[Any]:
        """
        Get a value from the cache.
        
        Args:
            prefix: Cache key prefix
            key_parts: Tuple of values to include in the cache key
            ttl: Time-to-live in seconds (overrides default_ttl if provided)
        
        Returns:
            Cached value or None if not found or expired
        """
        cache_key = self._get_cache_key(prefix, key_parts)
        cache_path = self._get_cache_path(cache_key)
        
        # Check if cache file exists
        if not os.path.exists(cache_path):
            return None
        
        try:
            # Read cache file
            with open(cache_path, "r") as f:
                cache_data = json.load(f)
            
            # Check if cache has expired
            timestamp = cache_data.get("_timestamp", 0)
            max_age = ttl or self.default_ttl
            
            if time.time() - timestamp > max_age:
                logger.debug(f"Cache expired for key: {cache_key}")
                return None
            
            logger.debug(f"Cache hit for key: {cache_key}")
            return cache_data.get("data")
            
        except Exception as e:
            logger.warning(f"Error reading cache for key {cache_key}: {str(e)}")
            return None
    
    def set(self, prefix: str, key_parts: Tuple, value: Any) -> None:
        """
        Set a value in the cache.
        
        Args:
            prefix: Cache key prefix
            key_parts: Tuple of values to include in the cache key
            value: Value to cache
        """
        cache_key = self._get_cache_key(prefix, key_parts)
        cache_path = self._get_cache_path(cache_key)
        
        try:
            # Create cache data with timestamp
            cache_data = {
                "_timestamp": time.time(),
                "data": value
            }
            
            # Write to cache file
            with open(cache_path, "w") as f:
                json.dump(cache_data, f)
            
            logger.debug(f"Cache set for key: {cache_key}")
            
        except Exception as e:
            logger.warning(f"Error writing cache for key {cache_key}: {str(e)}")
    
    def invalidate(self, prefix: str, key_parts: Optional[Tuple] = None) -> None:
        """
        Invalidate a cache entry or all entries with a given prefix.
        
        Args:
            prefix: Cache key prefix
            key_parts: Optional tuple of values to include in the cache key
        """
        if key_parts:
            # Invalidate specific cache entry
            cache_key = self._get_cache_key(prefix, key_parts)
            cache_path = self._get_cache_path(cache_key)
            
            if os.path.exists(cache_path):
                try:
                    os.remove(cache_path)
                    logger.debug(f"Invalidated cache for key: {cache_key}")
                except Exception as e:
                    logger.warning(f"Error invalidating cache for key {cache_key}: {str(e)}")
        else:
            # Invalidate all cache entries with the given prefix
            for filename in os.listdir(self.cache_dir):
                if filename.startswith(f"{prefix}_") and filename.endswith(".json"):
                    try:
                        os.remove(os.path.join(self.cache_dir, filename))
                        logger.debug(f"Invalidated cache for file: {filename}")
                    except Exception as e:
                        logger.warning(f"Error invalidating cache for file {filename}: {str(e)}")


def cached(prefix: str, ttl: Optional[int] = None):
    """
    Decorator to cache function results.
    
    Args:
        prefix: Cache key prefix
        ttl: Time-to-live in seconds (uses CacheManager default if not provided)
    
    Returns:
        Decorated function
    """
    cache_manager = CacheManager()
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function arguments
            # Skip self/cls argument for methods
            cache_args = args[1:] if args and hasattr(args[0], '__class__') else args
            
            # Include kwargs in cache key
            key_parts = cache_args + tuple(sorted(kwargs.items()))
            
            # Try to get from cache
            cached_result = cache_manager.get(prefix, key_parts, ttl)
            if cached_result is not None:
                return cached_result
            
            # Call the function and cache the result
            result = func(*args, **kwargs)
            cache_manager.set(prefix, key_parts, result)
            
            return result
        
        return wrapper
    
    return decorator