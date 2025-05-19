"""
Tests for GraphQL Cache Manager
"""

import asyncio
import pytest
import time
import json
from unittest.mock import Mock, patch
import redis

from src.api.shopify.cache_manager import (
    GraphQLCacheManager,
    CacheLevel,
    CacheEntry,
    RedisCache,
    cache_query
)


class TestCacheLevel:
    """Test individual cache level functionality"""
    
    def test_basic_get_set(self):
        """Test basic get/set operations"""
        cache = CacheLevel("test", max_size=1000, default_ttl=60)
        
        # Set value
        assert cache.set("key1", {"data": "value1"})
        
        # Get value
        result = cache.get("key1")
        assert result == {"data": "value1"}
        
        # Miss
        assert cache.get("nonexistent") is None
    
    def test_ttl_expiration(self):
        """Test TTL expiration"""
        cache = CacheLevel("test", max_size=1000, default_ttl=0.1)
        
        # Set value with short TTL
        cache.set("key1", "value1", ttl=0.05)
        
        # Should exist immediately
        assert cache.get("key1") == "value1"
        
        # Should expire after TTL
        time.sleep(0.1)
        assert cache.get("key1") is None
    
    def test_lru_eviction(self):
        """Test LRU eviction"""
        cache = CacheLevel("test", max_size=100, default_ttl=60)
        
        # Fill cache
        cache.set("key1", "a" * 30)  # 30 bytes
        cache.set("key2", "b" * 30)  # 30 bytes
        cache.set("key3", "c" * 30)  # 30 bytes
        
        # Access key1 to make it recently used
        cache.get("key1")
        
        # Add another item that causes eviction
        cache.set("key4", "d" * 30)
        
        # key2 should be evicted (least recently used)
        assert cache.get("key1") is not None
        assert cache.get("key2") is None
        assert cache.get("key3") is not None
        assert cache.get("key4") is not None
    
    def test_size_calculation(self):
        """Test size calculation"""
        cache = CacheLevel("test", max_size=1000, default_ttl=60)
        
        # Test different types
        assert cache._calculate_size({"key": "value"}) > 0
        assert cache._calculate_size("string") == len("string")
        assert cache._calculate_size(b"bytes") == len(b"bytes")
        assert cache._calculate_size(123) == 64  # Default
    
    def test_stats_collection(self):
        """Test statistics collection"""
        cache = CacheLevel("test", max_size=1000, default_ttl=60)
        
        # Generate some activity
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss
        cache.get("key3")  # Miss
        
        stats = cache.get_stats()
        
        assert stats['hits'] == 1
        assert stats['misses'] == 2
        assert stats['hit_rate'] == 1/3
        assert stats['size'] == 1
    
    def test_tag_filtering(self):
        """Test tag-based filtering"""
        cache = CacheLevel("test", max_size=1000, default_ttl=60)
        
        # Set entries with tags
        cache.set("key1", "value1", tags=["tag1", "tag2"])
        cache.set("key2", "value2", tags=["tag1"])
        cache.set("key3", "value3", tags=["tag2"])
        
        # Get by tag
        tag1_entries = cache.get_entries_by_tag("tag1")
        assert len(tag1_entries) == 2
        
        tag2_entries = cache.get_entries_by_tag("tag2")
        assert len(tag2_entries) == 2


class TestRedisCache:
    """Test Redis cache implementation"""
    
    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client"""
        mock = Mock(spec=redis.Redis)
        mock.get.return_value = None
        mock.setex.return_value = True
        mock.delete.return_value = 1
        mock.sadd.return_value = 1
        mock.expire.return_value = True
        mock.smembers.return_value = set()
        return mock
    
    def test_redis_get_set(self, mock_redis):
        """Test Redis get/set operations"""
        cache = RedisCache(mock_redis, prefix="test:")
        
        # Test set
        assert cache.set("key1", {"data": "value1"}, ttl=60)
        
        # Verify Redis calls
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "test:key1"
        assert call_args[0][1] == 60
        
        # Test get (miss)
        result = cache.get("key1")
        assert result is None
        
        # Test get (hit)
        mock_redis.get.return_value = json.dumps({
            "value": {"data": "value1"},
            "timestamp": time.time(),
            "tags": []
        }).encode()
        
        result = cache.get("key1")
        assert result == {"data": "value1"}
    
    def test_redis_error_handling(self, mock_redis):
        """Test Redis error handling"""
        cache = RedisCache(mock_redis, prefix="test:")
        
        # Simulate Redis error
        mock_redis.get.side_effect = redis.RedisError("Connection error")
        
        # Should handle gracefully
        result = cache.get("key1")
        assert result is None
        
        # Set should also handle errors
        mock_redis.setex.side_effect = redis.RedisError("Connection error")
        assert cache.set("key1", "value1") is False
    
    def test_redis_tags(self, mock_redis):
        """Test Redis tag operations"""
        cache = RedisCache(mock_redis, prefix="test:")
        
        # Set with tags
        cache.set("key1", "value1", tags=["tag1", "tag2"])
        
        # Verify tag sets were created
        assert mock_redis.sadd.call_count == 2
        mock_redis.sadd.assert_any_call("test:tag:tag1", "key1")
        mock_redis.sadd.assert_any_call("test:tag:tag2", "key1")
        
        # Test get by tag
        mock_redis.smembers.return_value = {b"key1", b"key2"}
        keys = cache.get_entries_by_tag("tag1")
        assert keys == [b"key1", b"key2"]


class TestGraphQLCacheManager:
    """Test GraphQL cache manager"""
    
    @pytest.fixture
    def cache_manager(self):
        """Create test cache manager"""
        return GraphQLCacheManager(
            memory_size=1000,
            memory_ttl=60,
            redis_client=None  # No Redis for unit tests
        )
    
    @pytest.mark.asyncio
    async def test_key_generation(self, cache_manager):
        """Test cache key generation"""
        query1 = "query { orders { id } }"
        vars1 = {"first": 10}
        
        query2 = "query { orders { id } }"
        vars2 = {"first": 10}
        
        query3 = "query { products { id } }"
        vars3 = {"first": 10}
        
        # Same query and vars should generate same key
        key1 = cache_manager.generate_key(query1, vars1)
        key2 = cache_manager.generate_key(query2, vars2)
        assert key1 == key2
        
        # Different query should generate different key
        key3 = cache_manager.generate_key(query3, vars3)
        assert key3 != key1
        
        # Different vars should generate different key
        key4 = cache_manager.generate_key(query1, {"first": 20})
        assert key4 != key1
    
    @pytest.mark.asyncio
    async def test_cache_flow(self, cache_manager):
        """Test complete cache flow"""
        query = "query { orders { id } }"
        variables = {"first": 10}
        result = {"orders": [{"id": "1"}, {"id": "2"}]}
        
        # Initial miss
        cached = await cache_manager.get(query, variables)
        assert cached is None
        assert cache_manager.metrics['cache_misses'] == 1
        
        # Set cache
        assert await cache_manager.set(query, variables, result)
        assert cache_manager.metrics['queries_cached'] == 1
        
        # Hit
        cached = await cache_manager.get(query, variables)
        assert cached == result
        assert cache_manager.metrics['cache_hits'] == 1
    
    @pytest.mark.asyncio
    async def test_cache_promotion(self, cache_manager):
        """Test cache level promotion"""
        # Add Redis cache
        mock_redis = Mock(spec=redis.Redis)
        mock_redis.get.return_value = json.dumps({
            "value": {"data": "from_redis"},
            "timestamp": time.time(),
            "tags": []
        }).encode()
        
        cache_manager.redis_cache = RedisCache(mock_redis)
        cache_manager.levels.append(cache_manager.redis_cache)
        
        query = "query { test }"
        
        # Get from Redis (L2)
        result = await cache_manager.get(query)
        assert result == {"data": "from_redis"}
        
        # Should be promoted to memory (L1)
        memory_result = cache_manager.memory_cache.get(
            cache_manager.generate_key(query)
        )
        assert memory_result == {"data": "from_redis"}
    
    @pytest.mark.asyncio
    async def test_invalidation_by_tags(self, cache_manager):
        """Test cache invalidation by tags"""
        # Add entries with tags
        await cache_manager.set(
            "query1", None, {"data": "1"}, tags=["orders"]
        )
        await cache_manager.set(
            "query2", None, {"data": "2"}, tags=["orders", "recent"]
        )
        await cache_manager.set(
            "query3", None, {"data": "3"}, tags=["products"]
        )
        
        # Invalidate by tag
        invalidated = await cache_manager.invalidate(tags=["orders"])
        
        # Check results
        assert await cache_manager.get("query1") is None
        assert await cache_manager.get("query2") is None
        assert await cache_manager.get("query3") == {"data": "3"}
    
    @pytest.mark.asyncio
    async def test_invalidation_by_pattern(self, cache_manager):
        """Test cache invalidation by pattern"""
        # Add entries
        await cache_manager.set("query_orders_1", None, {"data": "1"})
        await cache_manager.set("query_orders_2", None, {"data": "2"})
        await cache_manager.set("query_products_1", None, {"data": "3"})
        
        # Invalidate by pattern
        await cache_manager.invalidate(pattern="orders")
        
        # Check results
        assert await cache_manager.get("query_orders_1") is None
        assert await cache_manager.get("query_orders_2") is None
        assert await cache_manager.get("query_products_1") == {"data": "3"}
    
    @pytest.mark.asyncio
    async def test_redis_caching_decision(self, cache_manager):
        """Test decision logic for Redis caching"""
        # Small result - should not cache in Redis
        small_query = "query { shop { name } }"
        small_result = {"shop": {"name": "Test"}}
        assert not cache_manager._should_cache_in_redis(small_query, small_result)
        
        # Large result - should cache in Redis
        large_result = {"data": "x" * 2000}
        assert cache_manager._should_cache_in_redis("query", large_result)
        
        # Query with connections - should cache in Redis
        connection_query = "query { orders { edges { node { id } } } }"
        assert cache_manager._should_cache_in_redis(connection_query, {})
        
        # Historical query - should cache in Redis
        historical_query = "query { orders(createdAt: '2023-01-01') { id } }"
        assert cache_manager._should_cache_in_redis(historical_query, {})
    
    @pytest.mark.asyncio
    async def test_cache_decorator(self, cache_manager):
        """Test cache query decorator"""
        
        class TestClient:
            def __init__(self):
                self.cache_manager = cache_manager
                self.call_count = 0
            
            @cache_query(ttl=60, tags=["test"])
            async def execute_query(self, query, variables=None):
                self.call_count += 1
                return {"result": "data"}
        
        client = TestClient()
        
        # First call - should execute
        result1 = await client.execute_query(query="test", variables={})
        assert result1 == {"result": "data"}
        assert client.call_count == 1
        
        # Second call - should use cache
        result2 = await client.execute_query(query="test", variables={})
        assert result2 == {"result": "data"}
        assert client.call_count == 1  # Not incremented
    
    def test_cache_stats(self, cache_manager):
        """Test cache statistics"""
        # Generate some activity
        asyncio.run(cache_manager.set("q1", None, {"data": "1"}))
        asyncio.run(cache_manager.get("q1"))  # Hit
        asyncio.run(cache_manager.get("q2"))  # Miss
        
        stats = cache_manager.get_stats()
        
        assert stats['metrics']['cache_hits'] == 1
        assert stats['metrics']['cache_misses'] == 1
        assert stats['overall_hit_rate'] == 0.5
        assert len(stats['levels']) == 1  # Only memory level