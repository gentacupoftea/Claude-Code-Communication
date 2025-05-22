"""
Optimized Cache Manager for Shopify MCP Server
Implements a high-performance, multi-layered caching system with advanced features:
- Tiered caching (memory, shared memory, Redis)
- Smart TTL management based on data volatility
- Adaptive prefetching for frequently accessed data
- Memory-efficient storage with compression
- Thread-safe and async-compatible operations
- Comprehensive metrics and monitoring
"""

import asyncio
import json
import logging
import time
import hashlib
import pickle
import zlib
import lz4.frame  # For faster compression
from typing import Dict, Any, Optional, List, Tuple, Union, Callable, Set
from dataclasses import dataclass, field
from collections import OrderedDict, defaultdict
from threading import Lock
from functools import wraps

logger = logging.getLogger(__name__)

# Compression algorithms
COMPRESSION_ZLIB = "zlib"
COMPRESSION_LZ4 = "lz4"
COMPRESSION_NONE = "none"


@dataclass
class CacheMetadata:
    """Enhanced cache entry metadata with performance metrics"""
    key: str
    size: int
    ttl: float
    timestamp: float = field(default_factory=time.time)
    access_count: int = 0
    last_access: float = field(default_factory=time.time)
    query_cost: int = 0
    hit_count: int = 0
    miss_count: int = 0
    data_type: str = "unknown"
    compression_ratio: float = 1.0
    compression_algo: str = COMPRESSION_NONE
    tags: List[str] = field(default_factory=list)


class CacheValue:
    """Wrapper for cached values with compression support"""
    
    def __init__(self, 
                 value: Any, 
                 compress: bool = False, 
                 compress_threshold: int = 1024, 
                 algorithm: str = COMPRESSION_ZLIB):
        """Initialize cache value with optional compression
        
        Args:
            value: The data to cache
            compress: Whether to compress the data
            compress_threshold: Minimum size in bytes for compression
            algorithm: Compression algorithm to use (zlib, lz4, none)
        """
        self.compressed = False
        self.original_size = 0
        self._value = None
        self.algorithm = COMPRESSION_NONE
        
        # Store the value with optional compression
        self.set_value(value, compress, compress_threshold, algorithm)
    
    def set_value(self, 
                  value: Any, 
                  compress: bool = False, 
                  compress_threshold: int = 1024, 
                  algorithm: str = COMPRESSION_ZLIB) -> None:
        """Set or update the cached value
        
        Args:
            value: The data to cache
            compress: Whether to compress the data
            compress_threshold: Minimum size in bytes for compression
            algorithm: Compression algorithm to use (zlib, lz4, none)
        """
        # Serialize the data
        if isinstance(value, (dict, list, tuple)):
            serialized = pickle.dumps(value)
        elif isinstance(value, str):
            serialized = value.encode('utf-8')
        elif isinstance(value, bytes):
            serialized = value
        else:
            serialized = pickle.dumps(value)
        
        self.original_size = len(serialized)
        
        # Compress if needed
        if compress and self.original_size >= compress_threshold:
            if algorithm == COMPRESSION_LZ4:
                # LZ4 is faster but may have less compression
                self._value = lz4.frame.compress(serialized)
                self.algorithm = COMPRESSION_LZ4
            else:
                # Default to zlib (better compression ratio)
                self._value = zlib.compress(serialized)
                self.algorithm = COMPRESSION_ZLIB
            
            self.compressed = True
        else:
            self._value = serialized
            self.compressed = False
            self.algorithm = COMPRESSION_NONE
    
    def get_value(self) -> Any:
        """Get the original value, decompressing if necessary"""
        # Decompress if needed
        if self.compressed:
            if self.algorithm == COMPRESSION_LZ4:
                data = lz4.frame.decompress(self._value)
            else:  # Default to zlib
                data = zlib.decompress(self._value)
        else:
            data = self._value
        
        # Deserialize
        try:
            return pickle.loads(data)
        except Exception:
            # If pickle fails, try as string
            try:
                return data.decode('utf-8')
            except Exception:
                # Return as bytes if all else fails
                return data
    
    def get_size(self) -> int:
        """Get the current size in bytes"""
        return len(self._value)
    
    def get_compression_ratio(self) -> float:
        """Get the compression ratio (original / compressed)"""
        if self.compressed and self.original_size > 0:
            return self.original_size / len(self._value)
        return 1.0


class SmartCache:
    """Base smart cache implementation with advanced features"""
    
    def __init__(self, 
                 name: str,
                 max_size: int,
                 default_ttl: float,
                 ttl_variation_factor: float = 0.2):  # Added TTL variation factor
        """Initialize the cache
        
        Args:
            name: Cache name for logging and metrics
            max_size: Maximum size in bytes
            default_ttl: Default time-to-live in seconds
            ttl_variation_factor: Random variation factor for TTL to prevent cache stampedes
        """
        self.name = name
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.ttl_variation_factor = ttl_variation_factor
        self.cache: OrderedDict[str, Tuple[CacheValue, CacheMetadata]] = OrderedDict()
        self.total_size = 0
        self.hits = 0
        self.misses = 0
        
        # Monitoring data
        self.access_patterns: Dict[str, int] = defaultdict(int)
        self.data_types: Dict[str, int] = defaultdict(int)
        self.data_sizes: Dict[str, List[int]] = defaultdict(list)  # Track sizes by data type
        
        # Eviction statistics
        self.eviction_count = 0
        self.expired_count = 0
        
        # TTL statistics
        self.ttl_stats: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"min": float('inf'), "max": 0, "sum": 0, "count": 0}
        )
        
        # Dependency tracking
        self.dependencies: Dict[str, Set[str]] = defaultdict(set)
        
        # Locking
        self._lock = Lock()
        self._async_lock = asyncio.Lock()
    
    def _generate_key_hash(self, key: str) -> str:
        """Generate a consistent hash for a key"""
        return hashlib.md5(key.encode()).hexdigest()
    
    def _is_expired(self, metadata: CacheMetadata) -> bool:
        """Check if a cache entry is expired"""
        return time.time() - metadata.timestamp > metadata.ttl
    
    def _update_metadata(self, metadata: CacheMetadata, hit: bool = True) -> None:
        """Update cache entry metadata after access"""
        metadata.last_access = time.time()
        metadata.access_count += 1
        if hit:
            metadata.hit_count += 1
        else:
            metadata.miss_count += 1
    
    def _calculate_adaptive_ttl(self, key: str, data_type: str, base_ttl: float, data_size: int = 0) -> float:
        """Calculate adaptive TTL based on data type, access patterns, and data size
        
        This method adjusts TTL based on:
        1. Data volatility (e.g., inventory data changes frequently)
        2. Access frequency (frequently accessed data gets longer TTL)
        3. Update frequency (frequently updated data gets shorter TTL)
        4. Data size (larger data gets shorter TTL)
        """
        # Base multipliers for different data types
        type_multipliers = {
            "product": 1.5,        # Product data changes infrequently
            "inventory": 0.5,      # Inventory changes frequently
            "customer": 2.0,       # Customer data rarely changes
            "order": 1.0,          # Order data is moderately static
            "analytics": 3.0,      # Analytics data is very stable
            "settings": 0.3,       # Settings may change often
        }
        
        # Get type multiplier (default to 1.0 if unknown)
        type_multiplier = type_multipliers.get(data_type, 1.0)
        
        # Adjust based on access frequency
        access_count = self.access_patterns.get(key, 0)
        access_multiplier = min(2.0, 1.0 + (access_count / 50.0))
        
        # Adjust based on data size - NEW
        size_multiplier = 1.0
        if data_size > 0:
            # Large data gets shorter TTL (inverse relationship)
            # Sizes: <1KB: 1.2x, 1-10KB: 1.0x, 10-100KB: 0.8x, >100KB: 0.6x
            if data_size < 1024:  # < 1KB
                size_multiplier = 1.2
            elif data_size < 10 * 1024:  # 1-10KB
                size_multiplier = 1.0
            elif data_size < 100 * 1024:  # 10-100KB
                size_multiplier = 0.8
            else:  # > 100KB
                size_multiplier = 0.6
        
        # Calculate final TTL with some randomization to avoid cache stampedes
        ttl = base_ttl * type_multiplier * access_multiplier * size_multiplier
        
        # Add some random variation to prevent cache stampedes
        variation = 1.0 + ((hash(key) % 1000) / 1000.0 - 0.5) * 2 * self.ttl_variation_factor
        ttl *= variation
        
        # Update TTL statistics for this data type
        with self._lock:
            stats = self.ttl_stats[data_type]
            stats["min"] = min(stats["min"], ttl)
            stats["max"] = max(stats["max"], ttl)
            stats["sum"] += ttl
            stats["count"] += 1
        
        return ttl
    
    def _evict_entries(self, required_space: int) -> int:
        """Evict entries to make space, using smart eviction strategy
        
        Returns:
            int: Number of entries evicted
        """
        if not self.cache:
            return 0
        
        evicted = 0
        space_freed = 0
        
        # First, remove expired entries
        expired_keys = [
            key for key, (_, metadata) in self.cache.items() 
            if self._is_expired(metadata)
        ]
        
        for key in expired_keys:
            value, metadata = self.cache.pop(key)
            self.total_size -= value.get_size()
            space_freed += value.get_size()
            evicted += 1
            self.expired_count += 1
        
        # If we freed enough space, we're done
        if space_freed >= required_space:
            return evicted
        
        # Otherwise, start evicting based on a scoring algorithm
        # Score = (access_count * hit_ratio) / (size * age)
        # This favors keeping small, frequently accessed items with good hit rates
        
        scores = {}
        current_time = time.time()
        
        for key, (value, metadata) in self.cache.items():
            hit_ratio = metadata.hit_count / max(1, metadata.hit_count + metadata.miss_count)
            age = current_time - metadata.timestamp
            age_factor = max(1, age / 60)  # Normalize age to minutes, minimum 1
            size_factor = max(1, value.get_size() / 1024)  # Normalize size to KB, minimum 1
            
            # Calculate score (higher is better to keep)
            # Include data size in scoring - larger items easier to evict
            score = (metadata.access_count * hit_ratio) / (size_factor * age_factor)
            scores[key] = score
        
        # Sort by score (lowest first to evict)
        sorted_keys = sorted(scores.keys(), key=lambda k: scores[k])
        
        # Evict until we have enough space
        for key in sorted_keys:
            if space_freed >= required_space:
                break
                
            value, metadata = self.cache.pop(key)
            self.total_size -= value.get_size()
            space_freed += value.get_size()
            evicted += 1
            self.eviction_count += 1
            
            logger.debug(f"Evicted entry {key} with score {scores[key]:.4f} from {self.name} cache")
        
        return evicted
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache (thread-safe)"""
        with self._lock:
            # Look for the key or its hash
            key_hash = self._generate_key_hash(key)
            
            # Check if key exists in any form
            cache_key = key if key in self.cache else key_hash
            
            if cache_key not in self.cache:
                self.misses += 1
                self.access_patterns[key] += 1
                return None
            
            value, metadata = self.cache[cache_key]
            
            # Check if expired
            if self._is_expired(metadata):
                self.cache.pop(cache_key)
                self.total_size -= value.get_size()
                self.misses += 1
                self.access_patterns[key] += 1
                self.expired_count += 1
                return None
            
            # Update metadata
            self._update_metadata(metadata)
            self.hits += 1
            self.access_patterns[key] += 1
            
            # Move to end (LRU)
            self.cache.move_to_end(cache_key)
            
            # Return the value
            return value.get_value()
    
    async def get_async(self, key: str) -> Optional[Any]:
        """Get value from cache (async-safe)"""
        async with self._async_lock:
            return self.get(key)
    
    def set(self, 
            key: str, 
            value: Any, 
            ttl: Optional[float] = None,
            data_type: str = "unknown",
            compress: bool = False,
            algorithm: str = COMPRESSION_ZLIB,
            tags: Optional[List[str]] = None,
            dependencies: Optional[List[str]] = None) -> bool:
        """Set value in cache (thread-safe)"""
        with self._lock:
            # Create cache value with optional compression
            cache_value = CacheValue(value, compress=compress, algorithm=algorithm)
            value_size = cache_value.get_size()
            
            # If the value is larger than the max size, don't cache it
            if value_size > self.max_size:
                logger.warning(f"Value for key {key} is too large ({value_size} bytes) for {self.name} cache")
                return False
            
            # Calculate adaptive TTL
            base_ttl = ttl or self.default_ttl
            adaptive_ttl = self._calculate_adaptive_ttl(key, data_type, base_ttl, value_size)
            
            # Create metadata
            metadata = CacheMetadata(
                key=key,
                size=value_size,
                ttl=adaptive_ttl,
                data_type=data_type,
                compression_ratio=cache_value.get_compression_ratio(),
                compression_algo=cache_value.algorithm,
                tags=tags or []
            )
            
            # Hash the key for storage efficiency if it's long
            cache_key = key if len(key) < 64 else self._generate_key_hash(key)
            
            # Check if we need to evict entries to make space
            required_space = value_size
            if cache_key in self.cache:
                # Update existing entry - need to account for its current size
                old_value, _ = self.cache[cache_key]
                required_space -= old_value.get_size()
            
            if required_space > 0 and self.total_size + required_space > self.max_size:
                self._evict_entries(required_space)
            
            # Update total size
            if cache_key in self.cache:
                old_value, _ = self.cache[cache_key]
                self.total_size -= old_value.get_size()
            
            # Store the entry
            self.cache[cache_key] = (cache_value, metadata)
            self.total_size += value_size
            
            # Track data types and sizes for metrics
            self.data_types[data_type] += 1
            self.data_sizes[data_type].append(value_size)
            
            # Store dependencies
            if dependencies:
                for dep_key in dependencies:
                    self.dependencies[dep_key].add(key)
            
            return True
    
    async def set_async(self, 
                        key: str, 
                        value: Any, 
                        ttl: Optional[float] = None,
                        data_type: str = "unknown",
                        compress: bool = False,
                        algorithm: str = COMPRESSION_ZLIB,
                        tags: Optional[List[str]] = None,
                        dependencies: Optional[List[str]] = None) -> bool:
        """Set value in cache (async-safe)"""
        async with self._async_lock:
            return self.set(key, value, ttl, data_type, compress, algorithm, tags, dependencies)
    
    def invalidate(self, key: str) -> bool:
        """Remove a specific key from cache"""
        with self._lock:
            # Try direct key and hash
            key_hash = self._generate_key_hash(key)
            
            for cache_key in [key, key_hash]:
                if cache_key in self.cache:
                    value, _ = self.cache.pop(cache_key)
                    self.total_size -= value.get_size()
                    
                    # Invalidate any dependencies
                    if key in self.dependencies:
                        dependent_keys = list(self.dependencies[key])
                        for dep_key in dependent_keys:
                            self.invalidate(dep_key)
                        
                        # Clean up the dependency mapping
                        del self.dependencies[key]
                    
                    return True
            
            return False
    
    def invalidate_by_tags(self, tags: List[str]) -> int:
        """Invalidate entries by tags
        
        Returns:
            int: Number of entries invalidated
        """
        with self._lock:
            invalidated = 0
            keys_to_remove = []
            
            for cache_key, (value, metadata) in self.cache.items():
                if any(tag in metadata.tags for tag in tags):
                    keys_to_remove.append(cache_key)
                    invalidated += 1
            
            for cache_key in keys_to_remove:
                value, _ = self.cache.pop(cache_key)
                self.total_size -= value.get_size()
            
            return invalidated
    
    def invalidate_by_pattern(self, pattern: str) -> int:
        """Invalidate entries by key pattern
        
        Returns:
            int: Number of entries invalidated
        """
        with self._lock:
            invalidated = 0
            keys_to_remove = []
            
            for cache_key, (_, metadata) in self.cache.items():
                if pattern in metadata.key:
                    keys_to_remove.append(cache_key)
                    invalidated += 1
            
            for cache_key in keys_to_remove:
                value, _ = self.cache.pop(cache_key)
                self.total_size -= value.get_size()
            
            return invalidated
    
    def invalidate_dependencies(self, primary_key: str) -> int:
        """Invalidate a key and all its dependencies
        
        Returns:
            int: Number of entries invalidated
        """
        with self._lock:
            invalidated = 0
            
            # Invalidate the primary key first
            if self.invalidate(primary_key):
                invalidated += 1
            
            # Invalidate dependencies
            if primary_key in self.dependencies:
                dependent_keys = list(self.dependencies[primary_key])
                for dep_key in dependent_keys:
                    if self.invalidate(dep_key):
                        invalidated += 1
                
                # Clean up the dependency mapping
                del self.dependencies[primary_key]
            
            return invalidated
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self.hits + self.misses
            hit_rate = self.hits / total_requests if total_requests > 0 else 0
            
            # Analyze data types
            type_counts = dict(self.data_types)
            
            # Calculate average compression ratio
            compression_ratios = [metadata.compression_ratio for _, metadata in self.cache.values()]
            avg_compression = sum(compression_ratios) / len(compression_ratios) if compression_ratios else 1.0
            
            # Calculate average sizes by data type
            avg_sizes = {}
            for data_type, sizes in self.data_sizes.items():
                if sizes:
                    avg_sizes[data_type] = sum(sizes) / len(sizes)
            
            # Calculate average TTL by data type
            avg_ttl = {}
            for data_type, stats in self.ttl_stats.items():
                if stats["count"] > 0:
                    avg_ttl[data_type] = {
                        "min": stats["min"],
                        "max": stats["max"],
                        "avg": stats["sum"] / stats["count"]
                    }
            
            # Identify hot keys (frequently accessed)
            hot_keys = sorted(
                self.access_patterns.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:5]
            
            return {
                'name': self.name,
                'entries': len(self.cache),
                'total_size_bytes': self.total_size,
                'max_size_bytes': self.max_size,
                'usage_percent': (self.total_size / self.max_size * 100) if self.max_size > 0 else 0,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': hit_rate,
                'evictions': self.eviction_count,
                'expirations': self.expired_count,
                'data_types': type_counts,
                'avg_sizes': avg_sizes,
                'avg_ttl': avg_ttl,
                'avg_compression_ratio': avg_compression,
                'hot_keys': hot_keys,
                'dependencies': sum(len(deps) for deps in self.dependencies.values())
            }
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self.cache.clear()
            self.total_size = 0
            self.dependencies.clear()
            # Keep access patterns for future use
            logger.info(f"Cleared {self.name} cache")


class RedisSmartCache(SmartCache):
    """Redis-based smart cache implementation"""
    
    def __init__(self,
                 redis_client,
                 prefix: str = "shopify:optimized:",
                 max_size: int = 100_000_000,  # 100MB
                 default_ttl: float = 3600,
                 pool_size: int = 10,
                 connect_timeout: float = 1.0,
                 read_timeout: float = 0.5,
                 retry_count: int = 3,
                 retry_backoff: float = 0.1):
        """Initialize Redis-based cache
        
        Args:
            redis_client: Redis client instance
            prefix: Key prefix for Redis
            max_size: Maximum size estimate in bytes
            default_ttl: Default TTL in seconds
            pool_size: Connection pool size
            connect_timeout: Connection timeout in seconds
            read_timeout: Read timeout in seconds
            retry_count: Number of retries for failed operations
            retry_backoff: Backoff time between retries in seconds
        """
        super().__init__("redis", max_size, default_ttl)
        self.redis = redis_client
        self.prefix = prefix
        self.metadata_prefix = f"{prefix}meta:"
        self.tag_prefix = f"{prefix}tag:"
        self.dependency_prefix = f"{prefix}deps:"
        
        # Connection settings
        self.pool_size = pool_size
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.retry_count = retry_count
        self.retry_backoff = retry_backoff
        
        # Configure Redis connection pool if available
        self._configure_redis_pool()
    
    def _configure_redis_pool(self):
        """Configure Redis connection pool with proper settings"""
        try:
            if hasattr(self.redis, 'connection_pool'):
                pool = self.redis.connection_pool
                pool.max_connections = self.pool_size
                
                # Configure timeouts for connections
                for conn in pool._available_connections:
                    conn.socket_connect_timeout = self.connect_timeout
                    conn.socket_timeout = self.read_timeout
                
                logger.info(f"Configured Redis pool with size={self.pool_size}, "
                           f"connect_timeout={self.connect_timeout}s, "
                           f"read_timeout={self.read_timeout}s")
        except Exception as e:
            logger.warning(f"Failed to configure Redis pool: {e}")
    
    def _make_redis_key(self, key: str) -> str:
        """Create Redis key with prefix"""
        return f"{self.prefix}{key}"
    
    def _make_metadata_key(self, key: str) -> str:
        """Create Redis metadata key with prefix"""
        return f"{self.metadata_prefix}{key}"
    
    def _make_dependency_key(self, key: str) -> str:
        """Create Redis dependency key with prefix"""
        return f"{self.dependency_prefix}{key}"
    
    def _execute_with_retry(self, func, *args, **kwargs):
        """Execute Redis operation with retry logic"""
        last_error = None
        for attempt in range(self.retry_count):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_error = e
                if attempt < self.retry_count - 1:
                    # Calculate backoff with exponential increase
                    backoff = self.retry_backoff * (2 ** attempt)
                    logger.warning(f"Redis operation failed, retrying in {backoff:.2f}s: {e}")
                    time.sleep(backoff)
        
        # If we get here, all retries failed
        logger.error(f"Redis operation failed after {self.retry_count} attempts: {last_error}")
        raise last_error
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis"""
        redis_key = self._make_redis_key(key)
        meta_key = self._make_metadata_key(key)
        
        try:
            # Get data and metadata
            pipeline = self.redis.pipeline()
            pipeline.get(redis_key)
            pipeline.get(meta_key)
            results = self._execute_with_retry(pipeline.execute)
            
            data, meta_data = results
            
            if not data:
                self.misses += 1
                self.access_patterns[key] += 1
                return None
            
            # Parse metadata if available
            if meta_data:
                metadata = json.loads(meta_data)
                # Update access stats
                metadata['access_count'] = metadata.get('access_count', 0) + 1
                metadata['last_access'] = time.time()
                metadata['hit_count'] = metadata.get('hit_count', 0) + 1
                
                # Save updated metadata
                self._execute_with_retry(
                    self.redis.setex,
                    meta_key,
                    int(metadata.get('ttl', self.default_ttl)),
                    json.dumps(metadata)
                )
            
            # Update stats
            self.hits += 1
            self.access_patterns[key] += 1
            
            # Try to decode the data
            try:
                # Check for compression algorithm markers
                if data.startswith(b'\x78\x9c'):  # zlib magic number
                    data = zlib.decompress(data)
                elif data.startswith(b'\x04\x22\x4D\x18'):  # LZ4 frame marker
                    data = lz4.frame.decompress(data)
                
                # Try to unpickle
                return pickle.loads(data)
            except Exception:
                # If unpickling fails, return as is
                try:
                    return data.decode('utf-8')
                except Exception:
                    return data
                
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self.misses += 1
            return None
    
    async def get_async(self, key: str) -> Optional[Any]:
        """Async wrapper for Redis get"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.get, key)
    
    def set(self, 
            key: str, 
            value: Any, 
            ttl: Optional[float] = None,
            data_type: str = "unknown",
            compress: bool = True,
            algorithm: str = COMPRESSION_ZLIB,
            tags: Optional[List[str]] = None,
            dependencies: Optional[List[str]] = None) -> bool:
        """Set value in Redis with metadata"""
        redis_key = self._make_redis_key(key)
        meta_key = self._make_metadata_key(key)
        effective_ttl = ttl or self.default_ttl
        
        try:
            # Create and potentially compress the value
            cache_value = CacheValue(value, compress=compress, algorithm=algorithm)
            data = cache_value._value  # Get the raw (potentially compressed) value
            
            # Calculate adaptive TTL based on data size
            value_size = cache_value.get_size()
            adaptive_ttl = self._calculate_adaptive_ttl(key, data_type, effective_ttl, value_size)
            
            # Create metadata
            metadata = {
                'key': key,
                'timestamp': time.time(),
                'ttl': adaptive_ttl,
                'access_count': 0,
                'hit_count': 0,
                'miss_count': 0,
                'size': value_size,
                'data_type': data_type,
                'compression_ratio': cache_value.get_compression_ratio(),
                'compressed': cache_value.compressed,
                'compression_algo': cache_value.algorithm,
                'tags': tags or []
            }
            
            # Store data and metadata in a transaction
            pipeline = self.redis.pipeline()
            pipeline.setex(redis_key, int(adaptive_ttl), data)
            pipeline.setex(meta_key, int(adaptive_ttl), json.dumps(metadata))
            
            # Store tag references
            if tags:
                for tag in tags:
                    tag_key = f"{self.tag_prefix}{tag}"
                    pipeline.sadd(tag_key, key)
                    pipeline.expire(tag_key, int(adaptive_ttl))
            
            # Store dependencies if provided
            if dependencies:
                dependency_key = self._make_dependency_key(key)
                pipeline.delete(dependency_key)  # Remove old dependencies
                pipeline.sadd(dependency_key, *dependencies)
                pipeline.expire(dependency_key, int(adaptive_ttl))
                
                # Add this key as a dependent to each dependency
                for dep_key in dependencies:
                    dep_dependents_key = f"{self.dependency_prefix}deps:{dep_key}"
                    pipeline.sadd(dep_dependents_key, key)
                    pipeline.expire(dep_dependents_key, int(adaptive_ttl))
            
            self._execute_with_retry(pipeline.execute)
            
            # Update stats
            self.data_types[data_type] = self.data_types.get(data_type, 0) + 1
            self.data_sizes[data_type].append(value_size)
            
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    async def set_async(self, 
                        key: str, 
                        value: Any, 
                        ttl: Optional[float] = None,
                        data_type: str = "unknown",
                        compress: bool = True,
                        algorithm: str = COMPRESSION_ZLIB,
                        tags: Optional[List[str]] = None,
                        dependencies: Optional[List[str]] = None) -> bool:
        """Async wrapper for Redis set"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.set, key, value, ttl, data_type, compress, algorithm, tags, dependencies
        )
    
    def invalidate(self, key: str) -> bool:
        """Invalidate a key in Redis"""
        redis_key = self._make_redis_key(key)
        meta_key = self._make_metadata_key(key)
        dependency_key = self._make_dependency_key(key)
        
        try:
            # Get metadata to find tags
            meta_data = self._execute_with_retry(self.redis.get, meta_key)
            if meta_data:
                metadata = json.loads(meta_data)
                tags = metadata.get('tags', [])
                
                # Remove from tag indices
                for tag in tags:
                    tag_key = f"{self.tag_prefix}{tag}"
                    self._execute_with_retry(self.redis.srem, tag_key, key)
            
            # Check for dependencies - keys that depend on this key
            deps_key = f"{self.dependency_prefix}deps:{key}"
            dependent_keys = self._execute_with_retry(self.redis.smembers, deps_key)
            
            # Delete data, metadata, and dependency tracking
            pipeline = self.redis.pipeline()
            pipeline.delete(redis_key)
            pipeline.delete(meta_key)
            pipeline.delete(dependency_key)
            pipeline.delete(deps_key)
            
            # Also invalidate dependent keys
            for dep_key in dependent_keys:
                if isinstance(dep_key, bytes):
                    dep_key = dep_key.decode('utf-8')
                
                dep_redis_key = self._make_redis_key(dep_key)
                dep_meta_key = self._make_metadata_key(dep_key)
                pipeline.delete(dep_redis_key)
                pipeline.delete(dep_meta_key)
            
            result = self._execute_with_retry(pipeline.execute)
            
            return any(r > 0 for r in result)
        except Exception as e:
            logger.error(f"Redis invalidate error: {e}")
            return False
    
    def invalidate_by_tags(self, tags: List[str]) -> int:
        """Invalidate entries by tags in Redis"""
        invalidated = 0
        
        try:
            for tag in tags:
                tag_key = f"{self.tag_prefix}{tag}"
                keys = self._execute_with_retry(self.redis.smembers, tag_key)
                
                if keys:
                    # Delete all keys and their metadata
                    pipeline = self.redis.pipeline()
                    
                    for key in keys:
                        if isinstance(key, bytes):
                            key = key.decode('utf-8')
                        
                        redis_key = self._make_redis_key(key)
                        meta_key = self._make_metadata_key(key)
                        dependency_key = self._make_dependency_key(key)
                        
                        pipeline.delete(redis_key)
                        pipeline.delete(meta_key)
                        pipeline.delete(dependency_key)
                    
                    # Delete the tag set itself
                    pipeline.delete(tag_key)
                    
                    # Execute
                    self._execute_with_retry(pipeline.execute)
                    invalidated += len(keys)
            
            return invalidated
        except Exception as e:
            logger.error(f"Redis tag invalidation error: {e}")
            return invalidated
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Redis cache statistics"""
        base_stats = super().get_stats()
        
        try:
            # Count keys with our prefix
            pattern = f"{self.prefix}*"
            key_count = len(self._execute_with_retry(self.redis.keys, pattern))
            
            # Count metadata keys
            meta_pattern = f"{self.metadata_prefix}*"
            meta_count = len(self._execute_with_retry(self.redis.keys, meta_pattern))
            
            # Count dependency tracking keys
            deps_pattern = f"{self.dependency_prefix}*"
            deps_count = len(self._execute_with_retry(self.redis.keys, deps_pattern))
            
            # Get memory info if available
            try:
                memory_info = self._execute_with_retry(self.redis.info, 'memory')
                redis_used_memory = memory_info.get('used_memory', 0)
                redis_max_memory = memory_info.get('maxmemory', 0)
                redis_fragmentation = memory_info.get('mem_fragmentation_ratio', 0)
            except Exception:
                redis_used_memory = 0
                redis_max_memory = 0
                redis_fragmentation = 0
            
            # Connection pool stats
            conn_stats = {}
            if hasattr(self.redis, 'connection_pool'):
                pool = self.redis.connection_pool
                conn_stats = {
                    'max_connections': pool.max_connections,
                    'timeout': self.connect_timeout
                }
            
            # Add Redis-specific stats
            redis_stats = {
                'redis_keys': key_count,
                'redis_metadata_keys': meta_count,
                'redis_dependency_keys': deps_count,
                'redis_used_memory': redis_used_memory,
                'redis_max_memory': redis_max_memory,
                'redis_fragmentation': redis_fragmentation,
                'connection_pool': conn_stats,
                'retry_policy': {
                    'count': self.retry_count,
                    'backoff': self.retry_backoff
                }
            }
            
            return {**base_stats, **redis_stats}
        except Exception as e:
            logger.error(f"Redis stats error: {e}")
            return base_stats


class OptimizedCacheManager:
    """
    Optimized hierarchical cache manager with smart features:
    - Multi-level caching (memory, shared memory, Redis)
    - Adaptive TTL and prefetching
    - Data-type aware caching strategies
    - Comprehensive monitoring
    """
    
    def __init__(self,
                 memory_size: int = 50_000_000,       # 50MB
                 memory_ttl: float = 300,             # 5 minutes
                 redis_client = None,
                 redis_size: int = 500_000_000,       # 500MB
                 redis_ttl: float = 3600,             # 1 hour
                 redis_pool_size: int = 10,           # Connection pool size
                 redis_connect_timeout: float = 1.0,  # Connection timeout
                 redis_read_timeout: float = 0.5,     # Read timeout
                 enable_prefetching: bool = True,
                 enable_compression: bool = True,
                 compression_algorithm: str = COMPRESSION_ZLIB,
                 ttl_jitter: float = 0.2):            # TTL variation factor
        """
        Initialize optimized cache manager
        
        Args:
            memory_size: Max memory cache size in bytes
            memory_ttl: Default TTL for memory cache
            redis_client: Redis client instance (optional)
            redis_size: Max Redis cache size estimate
            redis_ttl: Default TTL for Redis cache
            redis_pool_size: Size of Redis connection pool
            redis_connect_timeout: Redis connection timeout in seconds
            redis_read_timeout: Redis read timeout in seconds
            enable_prefetching: Whether to enable adaptive prefetching
            enable_compression: Whether to enable automatic compression
            compression_algorithm: Default compression algorithm (zlib, lz4)
            ttl_jitter: Random TTL variation to prevent cache stampedes
        """
        # Settings
        self.enable_prefetching = enable_prefetching
        self.enable_compression = enable_compression
        self.compression_algorithm = compression_algorithm
        self.prefetch_threshold = 5  # Access count threshold for prefetching
        self.ttl_jitter = ttl_jitter
        
        # Initialize cache levels
        self.levels = []
        
        # L1: Memory cache
        self.memory_cache = SmartCache("memory", memory_size, memory_ttl, ttl_jitter)
        self.levels.append(self.memory_cache)
        
        # L2: Redis cache (optional)
        if redis_client:
            self.redis_cache = RedisSmartCache(
                redis_client, 
                "shopify:optimized:", 
                redis_size, 
                redis_ttl,
                pool_size=redis_pool_size,
                connect_timeout=redis_connect_timeout,
                read_timeout=redis_read_timeout
            )
            self.levels.append(self.redis_cache)
        else:
            self.redis_cache = None
        
        # Cache key generation
        self.key_prefix = "opt:"
        
        # Metrics
        self.metrics = {
            'requests': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'prefetches': 0,
            'prefetch_hits': 0,
            'compressed_entries': 0,
            'cache_saves': 0,
            'cache_evictions': 0,
            'bytes_saved': 0,
            'partial_updates': 0,
            'dependency_invalidations': 0
        }
        
        # Dependency tracking
        self.dependency_map: Dict[str, Set[str]] = defaultdict(set)
        
        # Prefetch tracking
        self._prefetch_candidates: Dict[str, int] = defaultdict(int)
        self._data_type_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {
            'hits': 0, 
            'misses': 0, 
            'size': 0, 
            'count': 0
        })
        
        # Lock for metrics
        self._metrics_lock = Lock()
        
        logger.info(f"Initialized OptimizedCacheManager with memory={memory_size/1024/1024:.1f}MB, "
                   f"Redis={'enabled' if redis_client else 'disabled'}, "
                   f"prefetching={enable_prefetching}, compression={enable_compression}")
    
    def generate_key(self, 
                     query: Union[str, Dict],
                     variables: Optional[Dict[str, Any]] = None) -> str:
        """Generate cache key from query and variables
        
        Args:
            query: GraphQL query string or query identifier dict
            variables: Query variables dictionary
        
        Returns:
            str: Cache key
        """
        # Handle dictionary input
        if isinstance(query, dict):
            key_data = {
                **query,
                'variables': variables or {}
            }
        else:
            # Create stable hash from query string
            key_data = {
                'query': query.strip(),
                'variables': variables or {}
            }
        
        # Serialize and hash
        key_str = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.sha256(key_str.encode()).hexdigest()[:16]
        
        return f"{self.key_prefix}{key_hash}"
    
    def _detect_data_type(self, query: str) -> str:
        """Detect data type from GraphQL query"""
        query_lower = query.lower()
        
        if 'product' in query_lower:
            return "product"
        elif 'inventory' in query_lower:
            return "inventory"
        elif 'customer' in query_lower:
            return "customer"
        elif 'order' in query_lower:
            return "order"
        elif 'analytic' in query_lower:
            return "analytics"
        elif 'setting' in query_lower:
            return "settings"
        else:
            return "unknown"
    
    def _should_compress(self, data: Any) -> bool:
        """Determine if data should be compressed"""
        if not self.enable_compression:
            return False
        
        # Check data size (estimate)
        data_size = 0
        if isinstance(data, dict) or isinstance(data, list):
            data_size = len(json.dumps(data))
        elif isinstance(data, str):
            data_size = len(data)
        elif isinstance(data, bytes):
            data_size = len(data)
        
        # Compression threshold based on data size
        # Only compress if size is significant to avoid compression overhead
        return data_size > 1024  # Compress if over 1KB
    
    def _should_cache_in_redis(self, query: str, data_type: str, result: Any) -> bool:
        """Determine if result should be cached in Redis"""
        # Always use Redis for these data types
        if data_type in ["product", "customer", "analytics"]:
            return True
        
        # Check result size
        result_size = 0
        if isinstance(result, dict):
            result_size = len(json.dumps(result))
        elif isinstance(result, str):
            result_size = len(result)
        elif isinstance(result, bytes):
            result_size = len(result)
        
        # Redis caching criteria
        return (
            result_size > 5120 or  # > 5KB goes to Redis
            'edges' in query or
            'connection' in query or
            'historical' in query.lower() or
            'createdAt' in query.lower() or
            'report' in query.lower()
        )
    
    def _update_prefetch_stats(self, key: str, hit: bool) -> None:
        """Update prefetch statistics for a key"""
        # Increment the access counter for this key
        self._prefetch_candidates[key] += 1
        
        # If we've surpassed the threshold, schedule prefetch
        if self.enable_prefetching and self._prefetch_candidates[key] >= self.prefetch_threshold:
            pass  # Prefetch logic will be implemented in the get method
    
    def _update_metrics(self, metric_name: str, increment: int = 1) -> None:
        """Thread-safe update of metrics"""
        with self._metrics_lock:
            self.metrics[metric_name] = self.metrics.get(metric_name, 0) + increment
    
    async def get(self, 
                  query: Union[str, Dict],
                  variables: Optional[Dict[str, Any]] = None, 
                  prefetch_related: bool = False) -> Optional[Any]:
        """Get cached query result
        
        Args:
            query: GraphQL query string or query identifier
            variables: Query variables
            prefetch_related: Whether to prefetch related data
        
        Returns:
            Optional[Any]: Cached result or None
        """
        key = self.generate_key(query, variables)
        self._update_metrics('requests')
        
        # Try each cache level
        for level in self.levels:
            result = await level.get_async(key)
            if result is not None:
                self._update_metrics('cache_hits')
                
                # Update prefetch stats
                self._update_prefetch_stats(key, True)
                
                # Promote to higher levels if not present
                for higher_level in self.levels[:self.levels.index(level)]:
                    await higher_level.set_async(key, result)
                
                # Perform related data prefetching if enabled
                if self.enable_prefetching and prefetch_related and isinstance(query, str):
                    data_type = self._detect_data_type(query)
                    await self._prefetch_related_data(data_type, result, query)
                
                return result
        
        self._update_metrics('cache_misses')
        self._update_prefetch_stats(key, False)
        return None
    
    async def _prefetch_related_data(self, data_type: str, data: Any, original_query: str) -> None:
        """Prefetch related data in the background
        
        This runs asynchronously and populates the cache with related data
        that is likely to be requested soon.
        """
        if not self.enable_prefetching:
            return
            
        # Example implementation based on data type
        try:
            prefetch_keys = []
            
            # Example prefetch logic based on data type
            if data_type == "product" and isinstance(data, dict):
                # If we have a product, maybe prefetch related products
                product_id = data.get('id')
                if product_id:
                    # Create a query for related products
                    related_query = f"query {{ product(id: \"{product_id}\") {{ relatedProducts {{ edges {{ node {{ id title }} }} }} }} }}"
                    prefetch_keys.append((related_query, {}))
                    
                    # Also prefetch inventory levels
                    inventory_query = f"query {{ inventoryLevel(productId: \"{product_id}\") {{ available }} }}"
                    prefetch_keys.append((inventory_query, {}))
            
            elif data_type == "order" and isinstance(data, dict):
                # If we have an order, maybe prefetch customer data
                customer_id = data.get('customerId')
                if customer_id:
                    customer_query = f"query {{ customer(id: \"{customer_id}\") {{ id email }} }}"
                    prefetch_keys.append((customer_query, {}))
            
            # Logging for prefetch decisions
            if prefetch_keys:
                logger.debug(f"Prefetching {len(prefetch_keys)} related items for {data_type}")
                self._update_metrics('prefetches', len(prefetch_keys))
                
                # Actual prefetching would require a fetcher function to be passed in
                # This would be implemented by the user of this class
        except Exception as e:
            logger.error(f"Error in prefetch logic: {e}")
    
    async def set(self, 
                  query: Union[str, Dict],
                  variables: Optional[Dict[str, Any]],
                  result: Any,
                  ttl: Optional[float] = None,
                  tags: Optional[List[str]] = None,
                  dependencies: Optional[List[str]] = None) -> bool:
        """Cache query result with smart caching logic
        
        Args:
            query: GraphQL query string or query identifier
            variables: Query variables
            result: Query result to cache
            ttl: Custom TTL (optional)
            tags: Tags for invalidation (optional)
            dependencies: Keys that this entry depends on (optional)
        
        Returns:
            bool: Success status
        """
        key = self.generate_key(query, variables)
        
        # Detect data type and determine caching strategy
        data_type = "unknown"
        if isinstance(query, str):
            data_type = self._detect_data_type(query)
        
        # Determine if we should compress
        compress = self._should_compress(result)
        if compress:
            self._update_metrics('compressed_entries')
        
        # Choose compression algorithm based on data size and type
        algorithm = self.compression_algorithm
        if isinstance(result, dict) or isinstance(result, list):
            # Use LZ4 for larger data (faster decompression)
            result_size = len(json.dumps(result))
            if result_size > 50 * 1024:  # > 50KB
                algorithm = COMPRESSION_LZ4
        
        # Determine cache level based on query type and result size
        cache_in_redis = self.redis_cache and self._should_cache_in_redis(
            query if isinstance(query, str) else "", data_type, result
        )
        
        # Save to appropriate levels
        success = False
        
        # Always save to memory
        memory_success = await self.memory_cache.set_async(
            key, result, ttl, data_type, compress, algorithm, tags, dependencies
        )
        
        if memory_success:
            success = True
            self._update_metrics('cache_saves')
            
            # Store dependencies in our local map
            if dependencies:
                for dep_key in dependencies:
                    self.dependency_map[dep_key].add(key)
        
        # Optionally save to Redis
        if cache_in_redis:
            redis_success = await self.redis_cache.set_async(
                key, result, ttl, data_type, compress, algorithm, tags, dependencies
            )
            
            if redis_success:
                success = True
        
        return success
    
    async def update_partial(self, 
                            key: str, 
                            updater: Callable[[Any], Any]) -> bool:
        """Update part of a cached value without invalidating the entire entry
        
        Args:
            key: Cache key to update
            updater: Function that takes the current value and returns the updated value
        
        Returns:
            bool: Whether the update was successful
        """
        # First try to get the value from cache
        result = None
        cache_level = None
        
        for level in self.levels:
            value = await level.get_async(key)
            if value is not None:
                result = value
                cache_level = level
                break
        
        if result is None or cache_level is None:
            return False  # Not found in any cache
        
        try:
            # Apply the updater function
            updated_result = updater(result)
            
            # Save the updated value back to all levels
            for level in self.levels:
                # Use existing metadata from the level where it was found
                if level == cache_level:
                    metadata = None
                    if hasattr(cache_level, "cache") and key in cache_level.cache:
                        _, metadata = cache_level.cache.get(key)
                    
                    ttl = metadata.ttl if metadata else None
                    tags = metadata.tags if metadata else None
                    data_type = metadata.data_type if metadata else "unknown"
                    
                    # Set with the same parameters as before
                    await level.set_async(
                        key, 
                        updated_result, 
                        ttl=ttl,
                        data_type=data_type,
                        compress=self.enable_compression,
                        algorithm=self.compression_algorithm,
                        tags=tags
                    )
            
            self._update_metrics('partial_updates')
            return True
        except Exception as e:
            logger.error(f"Error in partial update: {e}")
            return False
    
    async def invalidate(self, 
                         tags: Optional[List[str]] = None, 
                         pattern: Optional[str] = None,
                         data_type: Optional[str] = None) -> int:
        """Invalidate cache entries with multiple options
        
        Args:
            tags: Tags to invalidate
            pattern: Key pattern to invalidate
            data_type: Data type to invalidate
        
        Returns:
            int: Number of entries invalidated
        """
        invalidated = 0
        
        # Track tasks for async invalidation
        tasks = []
        
        for level in self.levels:
            if tags:
                # Invalidate by tags
                tasks.append(self._invalidate_by_tags(level, tags))
            
            elif pattern:
                # Invalidate by pattern
                tasks.append(self._invalidate_by_pattern(level, pattern))
            
            elif data_type:
                # Invalidate by data type
                tasks.append(self._invalidate_by_data_type(level, data_type))
        
        # Wait for all invalidation tasks to complete
        results = await asyncio.gather(*tasks)
        invalidated = sum(results)
        
        logger.info(f"Invalidated {invalidated} cache entries")
        return invalidated
    
    async def invalidate_dependencies(self, primary_key: str) -> int:
        """Invalidate a key and all its dependencies
        
        Args:
            primary_key: The primary key to invalidate
        
        Returns:
            int: Number of entries invalidated
        """
        invalidated = 0
        
        # Invalidate the primary key first
        for level in self.levels:
            if hasattr(level, 'invalidate'):
                if isinstance(level, RedisSmartCache):
                    # Redis implementation handles dependencies
                    result = await asyncio.to_thread(level.invalidate, primary_key)
                    if result:
                        invalidated += 1
                        
                else:
                    # Memory cache - use in-memory dependency map
                    result = await asyncio.to_thread(level.invalidate, primary_key)
                    if result:
                        invalidated += 1
                        
                    # Now invalidate dependencies
                    if primary_key in self.dependency_map:
                        dependent_keys = list(self.dependency_map[primary_key])
                        for dep_key in dependent_keys:
                            dep_result = await asyncio.to_thread(level.invalidate, dep_key)
                            if dep_result:
                                invalidated += 1
                        
                        # Clean up dependency map
                        del self.dependency_map[primary_key]
        
        self._update_metrics('dependency_invalidations', invalidated)
        return invalidated
    
    async def _invalidate_by_tags(self, level: Union[SmartCache, RedisSmartCache], tags: List[str]) -> int:
        """Helper method to invalidate by tags"""
        if hasattr(level, 'invalidate_by_tags'):
            if asyncio.iscoroutinefunction(level.invalidate_by_tags):
                return await level.invalidate_by_tags(tags)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, level.invalidate_by_tags, tags)
        return 0
    
    async def _invalidate_by_pattern(self, level: Union[SmartCache, RedisSmartCache], pattern: str) -> int:
        """Helper method to invalidate by pattern"""
        if hasattr(level, 'invalidate_by_pattern'):
            if asyncio.iscoroutinefunction(level.invalidate_by_pattern):
                return await level.invalidate_by_pattern(pattern)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, level.invalidate_by_pattern, pattern)
        return 0
    
    async def _invalidate_by_data_type(self, level: Union[SmartCache, RedisSmartCache], data_type: str) -> int:
        """Helper method to invalidate by data type"""
        # Since data type is stored in the metadata, we need to go through all entries
        # This is more efficient in Redis but might be slow for memory cache
        invalidated = 0
        
        if isinstance(level, SmartCache):
            with level._lock:
                keys_to_remove = []
                
                for cache_key, (_, metadata) in level.cache.items():
                    if getattr(metadata, 'data_type', None) == data_type:
                        keys_to_remove.append(cache_key)
                
                for cache_key in keys_to_remove:
                    value, _ = level.cache.pop(cache_key)
                    level.total_size -= value.get_size()
                    invalidated += 1
        
        elif isinstance(level, RedisSmartCache):
            try:
                # Find all metadata keys
                meta_pattern = f"{level.metadata_prefix}*"
                all_meta_keys = level.redis.keys(meta_pattern)
                keys_to_remove = []
                
                # Check each metadata for matching data type
                for meta_key in all_meta_keys:
                    meta_data = level.redis.get(meta_key)
                    if meta_data:
                        metadata = json.loads(meta_data)
                        if metadata.get('data_type') == data_type:
                            # Extract key from metadata key
                            key = meta_key.decode('utf-8').replace(level.metadata_prefix, '')
                            keys_to_remove.append(key)
                
                # Delete matching keys
                for key in keys_to_remove:
                    level.invalidate(key)
                    invalidated += 1
            
            except Exception as e:
                logger.error(f"Redis data type invalidation error: {e}")
        
        return invalidated
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        stats = {
            'metrics': self.metrics,
            'levels': []
        }
        
        for level in self.levels:
            stats['levels'].append(level.get_stats())
        
        # Calculate overall hit rate
        total_requests = self.metrics['cache_hits'] + self.metrics['cache_misses']
        stats['overall_hit_rate'] = (
            self.metrics['cache_hits'] / total_requests if total_requests > 0 else 0
        )
        
        # Add feature status
        stats['features'] = {
            'prefetching': self.enable_prefetching,
            'compression': self.enable_compression,
            'compression_algorithm': self.compression_algorithm,
            'dependency_tracking': len(self.dependency_map)
        }
        
        # Add data type statistics
        stats['data_type_stats'] = dict(self._data_type_stats)
        
        return stats
    
    async def clear(self) -> None:
        """Clear all cache levels"""
        for level in self.levels:
            level.clear()
        
        # Clear dependency map
        self.dependency_map.clear()
        
        logger.info("Cleared all cache levels")
        
        # Reset metrics
        with self._metrics_lock:
            for key in self.metrics:
                self.metrics[key] = 0
    
    async def warm_up(self, keys: List[Tuple[str, Dict[str, Any]]], fetcher: Callable) -> int:
        """Warm up cache with provided query keys and fetcher function
        
        Args:
            keys: List of (query, variables) tuples to warm up
            fetcher: Async function that fetches data given query and variables
        
        Returns:
            int: Number of entries successfully cached
        """
        success_count = 0
        
        # Use a batch size to avoid overwhelming the system
        batch_size = 10
        for i in range(0, len(keys), batch_size):
            batch = keys[i:i+batch_size]
            tasks = []
            
            for query, variables in batch:
                # Check if already in cache
                key = self.generate_key(query, variables)
                result = await self.get(query, variables)
                
                if result is None:
                    # Create a task to fetch and cache
                    tasks.append(self._warm_up_single(query, variables, fetcher))
            
            # Run all tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            success_count += sum(1 for r in results if r is True)
            
            # Avoid overwhelming the system
            if i + batch_size < len(keys):
                await asyncio.sleep(0.1)
        
        logger.info(f"Warmed up cache with {success_count} entries")
        return success_count
    
    async def _warm_up_single(self, query: str, variables: Dict[str, Any], fetcher: Callable) -> bool:
        """Helper to warm up a single entry"""
        try:
            data = await fetcher(query, variables)
            if data:
                success = await self.set(query, variables, data)
                return success
        except Exception as e:
            key = self.generate_key(query, variables)
            logger.error(f"Error warming up cache for {key}: {e}")
        
        return False


def optimized_cache_query(ttl: Optional[float] = None,
                         tags: Optional[List[str]] = None,
                         data_type: Optional[str] = None,
                         dependencies: Optional[List[str]] = None,
                         prefetch_related: bool = False,
                         compression: bool = True,
                         algorithm: str = COMPRESSION_ZLIB):
    """
    Enhanced decorator for caching GraphQL query results
    
    Args:
        ttl: Time to live in seconds
        tags: Cache tags for invalidation
        data_type: Type of data being cached
        dependencies: Keys that this cache entry depends on
        prefetch_related: Whether to prefetch related data
        compression: Whether to enable compression
        algorithm: Compression algorithm to use
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Generate cache key components
            query = kwargs.get('query', '')
            variables = kwargs.get('variables', {})
            
            # Auto-detect data type if not provided
            effective_data_type = data_type
            if not effective_data_type and isinstance(query, str):
                if hasattr(self, 'cache_manager') and isinstance(self.cache_manager, OptimizedCacheManager):
                    effective_data_type = self.cache_manager._detect_data_type(query)
            
            # Try to get from cache
            if hasattr(self, 'cache_manager') and isinstance(self.cache_manager, OptimizedCacheManager):
                result = await self.cache_manager.get(
                    query, variables, prefetch_related=prefetch_related
                )
                if result is not None:
                    return result
            
            # Execute query
            result = await func(self, *args, **kwargs)
            
            # Cache result if successful
            if hasattr(self, 'cache_manager') and isinstance(self.cache_manager, OptimizedCacheManager) and result:
                await self.cache_manager.set(
                    query,
                    variables,
                    result,
                    ttl=ttl,
                    tags=tags,
                    dependencies=dependencies
                )
            
            return result
        
        return wrapper
    return decorator