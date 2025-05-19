"""
Shopify GraphQL Cache Manager
Implements hierarchical caching with LRU eviction and TTL
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass, field
from collections import OrderedDict
import hashlib
import redis
from functools import wraps

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    size: int
    ttl: float
    timestamp: float = field(default_factory=time.time)
    access_count: int = 0
    last_access: float = field(default_factory=time.time)
    query_cost: int = 0
    tags: List[str] = field(default_factory=list)


class CacheLevel:
    """Individual cache level (memory or Redis)"""
    
    def __init__(self, 
                 name: str,
                 max_size: int,
                 default_ttl: float):
        self.name = name
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.total_size = 0
        self.hits = 0
        self.misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key in self.cache:
            entry = self.cache[key]
            
            # Check TTL
            if time.time() - entry.timestamp > entry.ttl:
                self.evict(key)
                self.misses += 1
                return None
            
            # Update access info
            entry.last_access = time.time()
            entry.access_count += 1
            
            # Move to end (LRU)
            self.cache.move_to_end(key)
            
            self.hits += 1
            return entry.value
        
        self.misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[float] = None,
            tags: Optional[List[str]] = None) -> bool:
        """Set value in cache"""
        # Calculate size
        size = self._calculate_size(value)
        
        # Check if we need to evict
        while self.total_size + size > self.max_size and self.cache:
            self._evict_lru()
        
        # Create entry
        entry = CacheEntry(
            key=key,
            value=value,
            size=size,
            ttl=ttl or self.default_ttl,
            tags=tags or []
        )
        
        # Add to cache
        self.cache[key] = entry
        self.total_size += size
        
        return True
    
    def evict(self, key: str) -> bool:
        """Evict specific key"""
        if key in self.cache:
            entry = self.cache.pop(key)
            self.total_size -= entry.size
            return True
        return False
    
    def _evict_lru(self):
        """Evict least recently used entry"""
        if self.cache:
            key, entry = self.cache.popitem(last=False)
            self.total_size -= entry.size
            logger.debug(f"Evicted {key} from {self.name} cache")
    
    def _calculate_size(self, value: Any) -> int:
        """Estimate size of value in bytes"""
        if isinstance(value, dict):
            return len(json.dumps(value))
        elif isinstance(value, str):
            return len(value)
        elif isinstance(value, bytes):
            return len(value)
        else:
            return 64  # Default size
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0
        
        return {
            'name': self.name,
            'size': len(self.cache),
            'total_size': self.total_size,
            'max_size': self.max_size,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': hit_rate,
        }
    
    def clear(self):
        """Clear all cache entries"""
        self.cache.clear()
        self.total_size = 0
    
    def get_entries_by_tag(self, tag: str) -> List[CacheEntry]:
        """Get all entries with specific tag"""
        return [entry for entry in self.cache.values() if tag in entry.tags]


class RedisCache(CacheLevel):
    """Redis-based cache level"""
    
    def __init__(self,
                 redis_client: redis.Redis,
                 prefix: str = "shopify:",
                 max_size: int = 100_000_000,  # 100MB
                 default_ttl: float = 3600):
        super().__init__("redis", max_size, default_ttl)
        self.redis = redis_client
        self.prefix = prefix
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis"""
        redis_key = f"{self.prefix}{key}"
        
        try:
            data = self.redis.get(redis_key)
            if data:
                self.hits += 1
                entry = json.loads(data)
                return entry['value']
            else:
                self.misses += 1
                return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self.misses += 1
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[float] = None,
            tags: Optional[List[str]] = None) -> bool:
        """Set value in Redis"""
        redis_key = f"{self.prefix}{key}"
        ttl = ttl or self.default_ttl
        
        try:
            entry = {
                'value': value,
                'timestamp': time.time(),
                'tags': tags or []
            }
            
            self.redis.setex(
                redis_key,
                int(ttl),
                json.dumps(entry)
            )
            
            # Add to tags index
            if tags:
                for tag in tags:
                    self.redis.sadd(f"{self.prefix}tag:{tag}", key)
                    self.redis.expire(f"{self.prefix}tag:{tag}", int(ttl))
            
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def evict(self, key: str) -> bool:
        """Evict from Redis"""
        redis_key = f"{self.prefix}{key}"
        
        try:
            return bool(self.redis.delete(redis_key))
        except Exception as e:
            logger.error(f"Redis evict error: {e}")
            return False
    
    def get_entries_by_tag(self, tag: str) -> List[str]:
        """Get keys by tag from Redis"""
        try:
            tag_key = f"{self.prefix}tag:{tag}"
            return list(self.redis.smembers(tag_key))
        except Exception as e:
            logger.error(f"Redis tag query error: {e}")
            return []


class GraphQLCacheManager:
    """
    Hierarchical cache manager for GraphQL queries
    Levels: Memory (L1) -> Redis (L2)
    """
    
    def __init__(self,
                 memory_size: int = 10_000_000,  # 10MB
                 memory_ttl: float = 300,        # 5 minutes
                 redis_client: Optional[redis.Redis] = None,
                 redis_size: int = 100_000_000,  # 100MB
                 redis_ttl: float = 3600):       # 1 hour
        """
        Initialize cache manager
        
        Args:
            memory_size: Max memory cache size in bytes
            memory_ttl: Default TTL for memory cache
            redis_client: Redis client instance (optional)
            redis_size: Max Redis cache size in bytes
            redis_ttl: Default TTL for Redis cache
        """
        # Initialize cache levels
        self.levels = []
        
        # L1: Memory cache
        self.memory_cache = CacheLevel("memory", memory_size, memory_ttl)
        self.levels.append(self.memory_cache)
        
        # L2: Redis cache (optional)
        if redis_client:
            self.redis_cache = RedisCache(redis_client, "shopify:", redis_size, redis_ttl)
            self.levels.append(self.redis_cache)
        else:
            self.redis_cache = None
        
        # Cache key generation
        self.key_prefix = "gql:"
        
        # Metrics
        self.metrics = {
            'queries_cached': 0,
            'cache_saves': 0,
            'cache_hits': 0,
            'cache_misses': 0,
        }
    
    def generate_key(self, query: str, variables: Optional[Dict[str, Any]] = None) -> str:
        """Generate cache key from query and variables"""
        # Create stable hash
        key_data = {
            'query': query.strip(),
            'variables': variables or {}
        }
        
        key_str = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.sha256(key_str.encode()).hexdigest()[:16]
        
        return f"{self.key_prefix}{key_hash}"
    
    async def get(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        """Get cached query result"""
        key = self.generate_key(query, variables)
        
        # Try each cache level
        for level in self.levels:
            result = level.get(key)
            if result is not None:
                self.metrics['cache_hits'] += 1
                
                # Promote to higher levels if not present
                for higher_level in self.levels[:self.levels.index(level)]:
                    higher_level.set(key, result)
                
                return result
        
        self.metrics['cache_misses'] += 1
        return None
    
    async def set(self, 
                  query: str,
                  variables: Optional[Dict[str, Any]],
                  result: Any,
                  ttl: Optional[float] = None,
                  tags: Optional[List[str]] = None) -> bool:
        """Cache query result"""
        key = self.generate_key(query, variables)
        
        # Determine cache level based on query type
        cache_in_redis = self._should_cache_in_redis(query, result)
        
        # Save to appropriate levels
        success = False
        
        # Always save to memory
        if self.memory_cache.set(key, result, ttl, tags):
            success = True
            self.metrics['cache_saves'] += 1
        
        # Optionally save to Redis
        if cache_in_redis and self.redis_cache:
            if self.redis_cache.set(key, result, ttl, tags):
                success = True
        
        if success:
            self.metrics['queries_cached'] += 1
        
        return success
    
    def _should_cache_in_redis(self, query: str, result: Any) -> bool:
        """Determine if query should be cached in Redis"""
        # Cache in Redis if:
        # 1. Result is large (>1KB)
        # 2. Query is expensive (contains multiple connections)
        # 3. Query is for historical data (unlikely to change)
        
        result_size = len(json.dumps(result)) if isinstance(result, dict) else 0
        
        return (
            result_size > 1024 or
            'edges' in query or
            'historical' in query.lower() or
            'createdAt' in query
        )
    
    async def invalidate(self, tags: Optional[List[str]] = None, pattern: Optional[str] = None):
        """Invalidate cache entries"""
        invalidated = 0
        
        for level in self.levels:
            if tags:
                # Invalidate by tags
                for tag in tags:
                    entries = level.get_entries_by_tag(tag)
                    for entry in entries:
                        key = entry.key if hasattr(entry, 'key') else entry
                        if level.evict(key):
                            invalidated += 1
            
            elif pattern:
                # Invalidate by pattern
                keys_to_evict = []
                
                if isinstance(level, CacheLevel):
                    for key in level.cache.keys():
                        if pattern in key:
                            keys_to_evict.append(key)
                
                for key in keys_to_evict:
                    if level.evict(key):
                        invalidated += 1
        
        logger.info(f"Invalidated {invalidated} cache entries")
        return invalidated
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
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
        
        return stats
    
    def clear(self):
        """Clear all cache levels"""
        for level in self.levels:
            level.clear()
        
        logger.info("Cleared all cache levels")


def cache_query(ttl: Optional[float] = None,
                tags: Optional[List[str]] = None,
                key_fields: Optional[List[str]] = None):
    """
    Decorator for caching GraphQL query results
    
    Args:
        ttl: Time to live in seconds
        tags: Cache tags for invalidation
        key_fields: Fields to include in cache key
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Generate cache key
            cache_key_data = {}
            
            if key_fields:
                for field in key_fields:
                    if field in kwargs:
                        cache_key_data[field] = kwargs[field]
            else:
                cache_key_data = kwargs
            
            # Try to get from cache
            if hasattr(self, 'cache_manager'):
                query = kwargs.get('query', '')
                variables = kwargs.get('variables', {})
                
                result = await self.cache_manager.get(query, variables)
                if result is not None:
                    return result
            
            # Execute query
            result = await func(self, *args, **kwargs)
            
            # Cache result
            if hasattr(self, 'cache_manager') and result:
                query = kwargs.get('query', '')
                variables = kwargs.get('variables', {})
                
                await self.cache_manager.set(
                    query,
                    variables,
                    result,
                    ttl=ttl,
                    tags=tags
                )
            
            return result
        
        return wrapper
    return decorator