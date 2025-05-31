import time
import json
import zlib
import logging
import hashlib
from typing import Any, Dict, List, Optional, Tuple, Union
import re
from collections import OrderedDict


class OptimizedCacheManager:
    """
    An optimized cache manager implementing a multi-level caching strategy.
    
    Features:
    - In-memory cache (L1) backed by Redis (L2)
    - Adaptive TTL based on data size and type
    - Data compression for large values
    - Smart eviction strategy based on access count, size, and age
    - Performance statistics tracking
    """
    
    def __init__(
        self,
        redis_client,
        memory_cache_size: int = 10000,
        redis_ttl: int = 3600,
        memory_ttl: int = 300,
        enable_compression: bool = True,
        compression_min_size: int = 1024,
        compression_level: int = 6,
        enable_adaptive_ttl: bool = True,
        ttl_min_factor: float = 0.5,
        ttl_max_factor: float = 2.0,
        ttl_size_threshold: int = 10000,
        track_metrics: bool = True
    ):
        """
        Initialize the OptimizedCacheManager.
        
        Args:
            redis_client: The Redis client instance.
            memory_cache_size: Maximum number of items to store in memory cache.
            redis_ttl: Default TTL for Redis entries in seconds.
            memory_ttl: Default TTL for memory cache entries in seconds.
            enable_compression: Whether to compress large values.
            compression_min_size: Minimum size in bytes for compression.
            compression_level: Compression level (1-9, higher = more compression).
            enable_adaptive_ttl: Whether to adjust TTL based on data properties.
            ttl_min_factor: Minimum TTL factor for adaptive TTL.
            ttl_max_factor: Maximum TTL factor for adaptive TTL.
            ttl_size_threshold: Size threshold for adaptive TTL adjustment.
            track_metrics: Whether to track cache performance metrics.
        """
        self.redis_client = redis_client
        self.memory_cache_size = memory_cache_size
        self.redis_ttl = redis_ttl
        self.memory_ttl = memory_ttl
        self.enable_compression = enable_compression
        self.compression_min_size = compression_min_size
        self.compression_level = compression_level
        self.enable_adaptive_ttl = enable_adaptive_ttl
        self.ttl_min_factor = ttl_min_factor
        self.ttl_max_factor = ttl_max_factor
        self.ttl_size_threshold = ttl_size_threshold
        self.track_metrics = track_metrics
        
        # Initialize memory cache as OrderedDict for LRU functionality
        self.memory_cache = OrderedDict()
        
        # Initialize metrics
        self.hits = 0
        self.misses = 0
        self.redis_hits = 0
        self.redis_misses = 0
        self.compressed_count = 0
        self.memory_evictions = 0
        
        # Logging setup
        self.logger = logging.getLogger("OptimizedCacheManager")
    
    def get(self, key: str, namespace: str = "") -> Any:
        """
        Get a value from the cache.
        
        Args:
            key: The cache key.
            namespace: Optional namespace for the key.
            
        Returns:
            The cached value or None if not found.
        """
        # Combine namespace and key
        full_key = self._get_full_key(key, namespace)
        
        # Try to get from memory cache first
        memory_result = self._get_from_memory(full_key)
        if memory_result is not None:
            if self.track_metrics:
                self.hits += 1
            return memory_result
            
        # Not in memory cache, try Redis
        redis_result = self._get_from_redis(full_key)
        if redis_result is not None:
            # Found in Redis, add to memory cache for next time
            self._set_in_memory(full_key, redis_result)
            if self.track_metrics:
                self.hits += 1
                self.redis_hits += 1
            return redis_result
            
        # Not found in either cache
        if self.track_metrics:
            self.misses += 1
            self.redis_misses += 1
        return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        namespace: str = "",
        use_adaptive_ttl: bool = None
    ) -> bool:
        """
        Set a value in the cache.
        
        Args:
            key: The cache key.
            value: The value to cache.
            ttl: Optional TTL override in seconds.
            namespace: Optional namespace for the key.
            use_adaptive_ttl: Whether to use adaptive TTL for this item.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        # Combine namespace and key
        full_key = self._get_full_key(key, namespace)
        
        # Determine TTL to use
        memory_ttl = ttl or self.memory_ttl
        redis_ttl = ttl or self.redis_ttl
        
        # Apply adaptive TTL if enabled
        if use_adaptive_ttl is None:
            use_adaptive_ttl = self.enable_adaptive_ttl
            
        if use_adaptive_ttl:
            adaptive_factor = self._calculate_adaptive_ttl(value)
            memory_ttl = int(memory_ttl * adaptive_factor)
            redis_ttl = int(redis_ttl * adaptive_factor)
        
        # Store in both caches
        self._set_in_memory(full_key, value, memory_ttl)
        return self._set_in_redis(full_key, value, redis_ttl)
    
    def invalidate(self, key: str, namespace: str = "") -> None:
        """
        Invalidate a specific cache entry.
        
        Args:
            key: The cache key to invalidate.
            namespace: Optional namespace for the key.
        """
        full_key = self._get_full_key(key, namespace)
        
        # Remove from memory cache
        if full_key in self.memory_cache:
            del self.memory_cache[full_key]
            
        # Remove from Redis
        self.redis_client.delete(full_key)
    
    def invalidate_pattern(self, pattern: str, namespace: str = "") -> None:
        """
        Invalidate all cache entries matching a pattern.
        
        Args:
            pattern: The pattern to match against keys.
            namespace: Optional namespace prefix.
        """
        # Create regex pattern for memory cache
        ns_prefix = f"{namespace}:" if namespace else ""
        regex_pattern = re.compile(f"^{re.escape(ns_prefix)}{pattern.replace('*', '.*')}$")
        
        # Clear matching keys from memory cache
        keys_to_remove = [k for k in self.memory_cache.keys() if regex_pattern.match(k)]
        for k in keys_to_remove:
            del self.memory_cache[k]
            
        # Clear matching keys from Redis
        redis_pattern = f"{ns_prefix}{pattern}"
        for key in self.redis_client.scan_iter(f"{redis_pattern}"):
            self.redis_client.delete(key)
    
    def invalidate_all(self) -> None:
        """Invalidate all cache entries in all caches."""
        # Clear memory cache
        self.memory_cache.clear()
        
        # Clear Redis cache - WARNING: this will clear ALL keys in Redis
        # In practice, you may want to use a prefix for all cache keys
        # and only clear keys with that prefix
        self.redis_client.flushdb()
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache performance statistics.
        
        Returns:
            Dict containing cache statistics.
        """
        total_requests = self.hits + self.misses
        hit_rate = self.get_hit_rate()
        
        stats = {
            "total_requests": total_requests,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "redis_hits": self.redis_hits,
            "redis_misses": self.redis_misses,
            "memory_cache_size": len(self.memory_cache),
            "memory_cache_limit": self.memory_cache_size,
            "memory_evictions": self.memory_evictions,
            "compressed_items": self.compressed_count
        }
        
        return stats
    
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
        # Scan the in-memory cache first
        memory_matches = []
        try:
            regex_pattern = pattern.replace('*', '.*')
            for key in self.memory_cache.keys():
                if re.match(regex_pattern, key):
                    memory_matches.append(key)
        except Exception as e:
            self.logger.error(f"Error scanning memory cache: {e}")
        
        # Scan Redis
        redis_matches = []
        try:
            for key in self.redis_client.scan_iter(pattern):
                # Convert bytes to str if needed
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                redis_matches.append(key)
        except Exception as e:
            self.logger.error(f"Error scanning Redis: {e}")
        
        # Combine results (removing duplicates)
        return list(set(memory_matches + redis_matches))
    
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
    
    def _get_from_memory(self, full_key: str) -> Any:
        """
        Get a value from the memory cache.
        
        Args:
            full_key: The full cache key.
            
        Returns:
            The cached value or None if not found or expired.
        """
        if full_key not in self.memory_cache:
            return None
            
        # Get value and metadata
        value, timestamp, ttl = self.memory_cache[full_key]
        
        # Check if expired
        if ttl > 0 and time.time() - timestamp > ttl:
            # Expired, remove from cache
            del self.memory_cache[full_key]
            return None
            
        # Move to end of OrderedDict to mark as recently used
        self.memory_cache.move_to_end(full_key)
        
        return value
    
    def _set_in_memory(self, full_key: str, value: Any, ttl: int = None) -> None:
        """
        Set a value in the memory cache.
        
        Args:
            full_key: The full cache key.
            value: The value to cache.
            ttl: Optional TTL in seconds.
        """
        # Check if cache is full and evict if necessary
        if len(self.memory_cache) >= self.memory_cache_size:
            # Evict least recently used item (first item in OrderedDict)
            self.memory_cache.popitem(last=False)
            if self.track_metrics:
                self.memory_evictions += 1
        
        # Store value with timestamp and TTL
        self.memory_cache[full_key] = (value, time.time(), ttl or self.memory_ttl)
    
    def _get_from_redis(self, full_key: str) -> Any:
        """
        Get a value from Redis.
        
        Args:
            full_key: The full cache key.
            
        Returns:
            The cached value or None if not found.
        """
        # Get from Redis
        redis_value = self.redis_client.get(full_key)
        if redis_value is None:
            return None
            
        try:
            # Parse JSON data
            data = json.loads(redis_value)
            
            # Extract value
            value = data.get("value")
            
            # Handle compressed data
            if data.get("compressed", False):
                value = self._decompress_value(value)
                
            return value
        except (json.JSONDecodeError, TypeError, zlib.error) as e:
            self.logger.error(f"Error decoding Redis value: {e}")
            return None
    
    def _set_in_redis(self, full_key: str, value: Any, ttl: int = None) -> bool:
        """
        Set a value in Redis.
        
        Args:
            full_key: The full cache key.
            value: The value to cache.
            ttl: Optional TTL in seconds.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        try:
            # Determine if compression should be used
            compressed = False
            serialized_value = json.dumps(value)
            
            # Check if value should be compressed
            if self.enable_compression and len(serialized_value) >= self.compression_min_size:
                value = self._compress_value(serialized_value)
                compressed = True
                if self.track_metrics:
                    self.compressed_count += 1
            
            # Prepare data for Redis
            data = {
                "value": value,
                "timestamp": time.time(),
                "compressed": compressed
            }
            
            # Store in Redis
            result = self.redis_client.set(
                full_key,
                json.dumps(data),
                ex=ttl or self.redis_ttl
            )
            
            return result
        except (TypeError, json.JSONDecodeError, zlib.error) as e:
            self.logger.error(f"Error encoding value for Redis: {e}")
            return False
    
    def _calculate_adaptive_ttl(self, value: Any) -> float:
        """
        Calculate an adaptive TTL factor based on value properties.
        
        Args:
            value: The value to analyze.
            
        Returns:
            A TTL adjustment factor.
        """
        try:
            # Serialize to estimate size
            if isinstance(value, (str, bytes)):
                size = len(value)
            else:
                size = len(json.dumps(value))
                
            # Calculate factor based on size (smaller = longer TTL)
            if size <= 100:
                # Very small objects get maximum TTL
                factor = self.ttl_max_factor
            elif size >= self.ttl_size_threshold:
                # Very large objects get minimum TTL
                factor = self.ttl_min_factor
            else:
                # Linear interpolation for sizes in between
                range_size = self.ttl_size_threshold - 100
                position = (size - 100) / range_size
                factor_range = self.ttl_max_factor - self.ttl_min_factor
                factor = self.ttl_max_factor - (position * factor_range)
                
            # Add some jitter to prevent cache stampedes
            factor *= 0.9 + (hash(str(value)) % 20) / 100
                
            return factor
        except (TypeError, json.JSONDecodeError):
            # If we can't analyze, use default TTL
            return 1.0
    
    def _compress_value(self, value: str) -> bytes:
        """
        Compress a value using zlib.
        
        Args:
            value: The string value to compress.
            
        Returns:
            The compressed value as a base64 string.
        """
        if isinstance(value, str):
            value = value.encode('utf-8')
        return zlib.compress(value, level=self.compression_level)
    
    def _decompress_value(self, value) -> Any:
        """
        Decompress a value using zlib.
        
        Args:
            value: The compressed value.
            
        Returns:
            The decompressed value.
        """
        if isinstance(value, str):
            try:
                value = value.encode('utf-8')
            except AttributeError:
                pass
                
        decompressed = zlib.decompress(value)
        try:
            # Try to decode as JSON
            return json.loads(decompressed)
        except (json.JSONDecodeError, UnicodeDecodeError):
            # If not valid JSON, return as string
            try:
                return decompressed.decode('utf-8')
            except UnicodeDecodeError:
                # If can't decode as UTF-8, return raw bytes
                return decompressed