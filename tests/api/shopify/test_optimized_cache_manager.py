"""Tests for the optimized cache manager implementation."""

import asyncio
import json
import pickle
import pytest
import time
from unittest.mock import MagicMock, patch

from src.api.shopify.optimized_cache_manager import (
    CacheValue,
    SmartCache,
    RedisSmartCache,
    OptimizedCacheManager,
    optimized_cache_query
)


@pytest.fixture
def smart_cache():
    """Create a SmartCache instance for testing."""
    return SmartCache("test_cache", 10_000_000, 300)


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = MagicMock()
    redis.get.return_value = None
    redis.setex.return_value = True
    redis.pipeline.return_value = redis
    redis.execute.return_value = [None, None]
    return redis


@pytest.fixture
def redis_smart_cache(mock_redis):
    """Create a RedisSmartCache instance for testing."""
    return RedisSmartCache(mock_redis, "test:", 10_000_000, 300)


@pytest.fixture
def optimized_cache_manager(mock_redis):
    """Create an OptimizedCacheManager instance for testing."""
    return OptimizedCacheManager(
        memory_size=1_000_000,
        memory_ttl=300,
        redis_client=mock_redis,
        redis_size=10_000_000,
        redis_ttl=3600
    )


class TestCacheValue:
    """Tests for CacheValue class."""
    
    def test_initialization(self):
        """Test CacheValue initialization."""
        value = {"test": "data"}
        cache_value = CacheValue(value)
        
        assert not cache_value.compressed
        assert cache_value.original_size > 0
        assert cache_value.get_value() == value
    
    def test_compression(self):
        """Test compression functionality."""
        large_value = {"large": "x" * 10000}
        cache_value = CacheValue(large_value, compress=True)
        
        assert cache_value.compressed
        assert cache_value.get_compression_ratio() > 1.0
        assert cache_value.get_value() == large_value
    
    def test_string_value(self):
        """Test with string value."""
        value = "test string data"
        cache_value = CacheValue(value)
        
        assert cache_value.get_value() == value


class TestSmartCache:
    """Tests for SmartCache class."""
    
    def test_set_get(self, smart_cache):
        """Test basic set/get operations."""
        key = "test_key"
        value = {"test": "data"}
        
        # Set value
        smart_cache.set(key, value)
        
        # Get value
        result = smart_cache.get(key)
        assert result == value
        assert smart_cache.hits == 1
        assert smart_cache.misses == 0
    
    def test_ttl_expiration(self, smart_cache):
        """Test TTL expiration."""
        key = "expiring_key"
        value = {"test": "expiring"}
        
        # Set with short TTL
        smart_cache.set(key, value, ttl=0.1)
        
        # Get immediately
        result1 = smart_cache.get(key)
        assert result1 == value
        
        # Wait for expiration
        time.sleep(0.2)
        
        # Try to get again
        result2 = smart_cache.get(key)
        assert result2 is None
        assert smart_cache.hits == 1
        assert smart_cache.misses == 1
    
    def test_invalidation(self, smart_cache):
        """Test key invalidation."""
        smart_cache.set("key1", "value1")
        smart_cache.set("key2", "value2")
        
        # Invalidate one key
        result = smart_cache.invalidate("key1")
        assert result is True
        
        # Check keys
        assert smart_cache.get("key1") is None
        assert smart_cache.get("key2") == "value2"
    
    def test_tag_invalidation(self, smart_cache):
        """Test tag-based invalidation."""
        smart_cache.set("key1", "value1", tags=["tag1", "tag2"])
        smart_cache.set("key2", "value2", tags=["tag2"])
        smart_cache.set("key3", "value3", tags=["tag3"])
        
        # Invalidate by tag
        count = smart_cache.invalidate_by_tags(["tag2"])
        assert count == 2
        
        # Check keys
        assert smart_cache.get("key1") is None
        assert smart_cache.get("key2") is None
        assert smart_cache.get("key3") == "value3"
    
    def test_adaptive_ttl(self, smart_cache):
        """Test adaptive TTL calculation."""
        # Set key with specific data type
        key = "product_key"
        smart_cache.set(key, {"id": 123}, data_type="product")
        
        # Access key multiple times to increase access count
        for _ in range(10):
            smart_cache.get(key)
        
        # Check that access pattern was recorded
        assert key in smart_cache.access_patterns
        assert smart_cache.access_patterns[key] == 10
    
    def test_eviction(self, smart_cache):
        """Test eviction when cache is full."""
        # Create a small cache for testing eviction
        small_cache = SmartCache("small", 100, 300)
        
        # Add entries until eviction occurs
        for i in range(10):
            key = f"key{i}"
            value = "x" * 20  # Each entry is about 20 bytes
            small_cache.set(key, value)
        
        # Verify that some entries were evicted
        assert len(small_cache.cache) < 10
        
        # Check stats
        stats = small_cache.get_stats()
        assert stats["total_size_bytes"] <= small_cache.max_size


@pytest.mark.asyncio
class TestRedisSmartCache:
    """Tests for RedisSmartCache class."""
    
    async def test_async_set_get(self, redis_smart_cache):
        """Test async set/get operations."""
        key = "test_key"
        value = {"test": "data"}
        
        # Configure mock to return value
        encoded_value = pickle.dumps(value)
        redis_smart_cache.redis.get.return_value = encoded_value
        redis_smart_cache.redis.execute.return_value = [encoded_value, json.dumps({})]
        
        # Set value
        await redis_smart_cache.set_async(key, value)
        
        # Get value
        result = await redis_smart_cache.get_async(key)
        assert result == value
    
    async def test_tag_operations(self, redis_smart_cache):
        """Test tag operations with Redis."""
        # Set up mock responses
        redis_smart_cache.redis.smembers.return_value = ["key1", "key2"]
        
        # Invalidate by tag
        count = await redis_smart_cache.invalidate_by_tags(["tag1"])
        
        # Verify Redis operations
        assert redis_smart_cache.redis.smembers.called
        assert redis_smart_cache.redis.delete.called


@pytest.mark.asyncio
class TestOptimizedCacheManager:
    """Tests for OptimizedCacheManager class."""
    
    async def test_hierarchical_caching(self, optimized_cache_manager):
        """Test hierarchical caching behavior."""
        query = "query { products { edges { node { id } } } }"
        variables = {"first": 10}
        result = {"data": {"products": {"edges": []}}}
        
        # Set up Redis mock to miss first, then hit
        optimized_cache_manager.redis_cache.get = MagicMock(return_value=None)
        optimized_cache_manager.redis_cache.set_async = MagicMock(return_value=True)
        
        # Cache the result
        success = await optimized_cache_manager.set(query, variables, result)
        assert success is True
        
        # Get from memory cache
        memory_get_spy = MagicMock(return_value=result)
        optimized_cache_manager.memory_cache.get_async = memory_get_spy
        
        cached_result = await optimized_cache_manager.get(query, variables)
        assert cached_result == result
        assert memory_get_spy.called
    
    async def test_data_type_detection(self, optimized_cache_manager):
        """Test data type detection from query."""
        # Product query
        product_query = "query { product(id: 123) { id title } }"
        assert optimized_cache_manager._detect_data_type(product_query) == "product"
        
        # Inventory query
        inventory_query = "query { inventoryLevel(id: 123) { available } }"
        assert optimized_cache_manager._detect_data_type(inventory_query) == "inventory"
        
        # Unknown query
        unknown_query = "query { something { id } }"
        assert optimized_cache_manager._detect_data_type(unknown_query) == "unknown"
    
    async def test_invalidation(self, optimized_cache_manager):
        """Test invalidation methods."""
        query1 = "query { product(id: 1) { id } }"
        query2 = "query { product(id: 2) { id } }"
        result = {"data": {"product": {"id": 1}}}
        
        # Set up test data
        await optimized_cache_manager.set(query1, {}, result, tags=["product", "test"])
        await optimized_cache_manager.set(query2, {}, result, tags=["product"])
        
        # Mock level methods for testing
        optimized_cache_manager.memory_cache.invalidate_by_tags = MagicMock(return_value=2)
        optimized_cache_manager.redis_cache.invalidate_by_tags = MagicMock(return_value=2)
        
        # Invalidate by tags
        count = await optimized_cache_manager.invalidate(tags=["product"])
        assert count == 4  # 2 from memory + 2 from Redis
        
        # Verify calls
        assert optimized_cache_manager.memory_cache.invalidate_by_tags.called
        assert optimized_cache_manager.redis_cache.invalidate_by_tags.called


@pytest.mark.asyncio
class TestOptimizedCacheDecorator:
    """Tests for optimized_cache_query decorator."""
    
    class TestClient:
        """Test client class that uses the cache decorator."""
        
        def __init__(self, cache_manager):
            self.cache_manager = cache_manager
            self.call_count = 0
        
        @optimized_cache_query(ttl=60, tags=["test"])
        async def fetch_data(self, query, variables=None):
            """Test method with cache decorator."""
            self.call_count += 1
            return {"data": {"test": True}}
    
    async def test_decorator_caching(self, optimized_cache_manager):
        """Test that decorator properly caches results."""
        client = self.TestClient(optimized_cache_manager)
        query = "query { test }"
        
        # First call - should execute the method
        result1 = await client.fetch_data(query=query)
        assert result1 == {"data": {"test": True}}
        assert client.call_count == 1
        
        # Second call - should use cache
        result2 = await client.fetch_data(query=query)
        assert result2 == {"data": {"test": True}}
        assert client.call_count == 1  # Call count shouldn't increase
    
    async def test_decorator_different_queries(self, optimized_cache_manager):
        """Test that different queries are cached separately."""
        client = self.TestClient(optimized_cache_manager)
        
        # First query
        await client.fetch_data(query="query { testA }")
        assert client.call_count == 1
        
        # Different query
        await client.fetch_data(query="query { testB }")
        assert client.call_count == 2  # Should increase
        
        # Repeat first query
        await client.fetch_data(query="query { testA }")
        assert client.call_count == 2  # Should not increase