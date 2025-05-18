"""
Tests for Google Analytics cache implementation.
"""
import pytest
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
import hashlib

from src.google_analytics.cache import CacheLayer
from src.google_analytics.models import AnalyticsReport, Row


class TestCacheLayer:
    """Test cases for CacheLayer."""

    @pytest.fixture
    def cache(self, mock_redis_client):
        """Create a test cache instance."""
        return CacheLayer(redis_client=mock_redis_client, ttl=300)

    @pytest.fixture
    def cache_key_data(self):
        """Sample data for cache key generation."""
        return {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "date"}],
            "date_ranges": [{
                "start_date": "2024-01-01",
                "end_date": "2024-01-07"
            }]
        }

    def test_generate_cache_key(self, cache, cache_key_data):
        """Test cache key generation."""
        key = cache._generate_cache_key(cache_key_data)
        
        # Key should be consistent for same data
        key2 = cache._generate_cache_key(cache_key_data)
        assert key == key2
        
        # Key should be different for different data
        modified_data = cache_key_data.copy()
        modified_data["metrics"] = [{"name": "users"}]
        key3 = cache._generate_cache_key(modified_data)
        assert key != key3
        
        # Key should be a valid string
        assert isinstance(key, str)
        assert len(key) > 0

    @pytest.mark.asyncio
    async def test_get_cache_hit(self, cache, mock_redis_client, sample_analytics_report):
        """Test cache hit scenario."""
        # Setup cached data
        cached_data = json.dumps(sample_analytics_report.dict())
        mock_redis_client.get.return_value = cached_data
        
        key = "test_key"
        result = await cache.get(key)
        
        assert isinstance(result, AnalyticsReport)
        assert result.row_count == sample_analytics_report.row_count
        mock_redis_client.get.assert_called_once_with(key)

    @pytest.mark.asyncio
    async def test_get_cache_miss(self, cache, mock_redis_client):
        """Test cache miss scenario."""
        mock_redis_client.get.return_value = None
        
        key = "test_key"
        result = await cache.get(key)
        
        assert result is None
        mock_redis_client.get.assert_called_once_with(key)

    @pytest.mark.asyncio
    async def test_get_invalid_json(self, cache, mock_redis_client):
        """Test handling of invalid JSON in cache."""
        mock_redis_client.get.return_value = "invalid json"
        
        key = "test_key"
        result = await cache.get(key)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_set_cache(self, cache, mock_redis_client, sample_analytics_report):
        """Test setting cache data."""
        key = "test_key"
        await cache.set(key, sample_analytics_report)
        
        mock_redis_client.setex.assert_called_once()
        call_args = mock_redis_client.setex.call_args
        assert call_args[0][0] == key
        assert call_args[0][1] == 300  # TTL
        
        # Verify data is properly serialized
        cached_data = json.loads(call_args[0][2])
        assert cached_data["row_count"] == sample_analytics_report.row_count

    @pytest.mark.asyncio
    async def test_set_cache_error(self, cache, mock_redis_client, sample_analytics_report):
        """Test error handling when setting cache."""
        mock_redis_client.setex.side_effect = Exception("Redis error")
        
        key = "test_key"
        # Should not raise exception
        await cache.set(key, sample_analytics_report)
        
        mock_redis_client.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_cache(self, cache, mock_redis_client):
        """Test cache deletion."""
        key = "test_key"
        await cache.delete(key)
        
        mock_redis_client.delete.assert_called_once_with(key)

    @pytest.mark.asyncio
    async def test_invalidate_pattern(self, cache, mock_redis_client):
        """Test pattern-based cache invalidation."""
        mock_redis_client.scan_iter = Mock(return_value=iter([
            "cache:ga:123456789:*",
            "cache:ga:123456789:report1",
            "cache:ga:123456789:report2"
        ]))
        
        await cache.invalidate_pattern("cache:ga:123456789:*")
        
        # Should delete all matching keys
        assert mock_redis_client.delete.call_count == 3

    @pytest.mark.asyncio
    async def test_cached_decorator(self, cache, mock_redis_client):
        """Test @cached decorator functionality."""
        # Mock function to be cached
        call_count = 0
        
        @cache.cached("test_prefix")
        async def expensive_operation(param: str) -> str:
            nonlocal call_count
            call_count += 1
            return f"result_{param}"
        
        # First call - cache miss
        mock_redis_client.get.return_value = None
        result1 = await expensive_operation("test")
        assert result1 == "result_test"
        assert call_count == 1
        
        # Second call - cache hit
        mock_redis_client.get.return_value = json.dumps("result_test")
        result2 = await expensive_operation("test")
        assert result2 == "result_test"
        assert call_count == 1  # Function not called again

    @pytest.mark.asyncio
    async def test_cache_with_complex_key(self, cache):
        """Test cache key generation with complex nested data."""
        complex_data = {
            "property_id": "123456789",
            "metrics": [
                {"name": "sessions", "expression": None},
                {"name": "users", "expression": "totalUsers"}
            ],
            "dimensions": [
                {"name": "date"},
                {"name": "country"},
                {"name": "deviceCategory"}
            ],
            "date_ranges": [{
                "start_date": "2024-01-01",
                "end_date": "2024-01-07"
            }],
            "dimension_filter": {
                "filter": {
                    "field_name": "country",
                    "string_filter": {
                        "match_type": "EXACT",
                        "value": "Japan"
                    }
                }
            },
            "order_bys": [{
                "field": "sessions",
                "desc": True
            }],
            "limit": 1000,
            "offset": 0
        }
        
        key = cache._generate_cache_key(complex_data)
        
        # Key should be deterministic
        key2 = cache._generate_cache_key(complex_data)
        assert key == key2

    @pytest.mark.asyncio
    async def test_ttl_configuration(self):
        """Test TTL configuration."""
        mock_redis = Mock()
        
        # Test with custom TTL
        cache = CacheLayer(redis_client=mock_redis, ttl=600)
        assert cache.ttl == 600
        
        # Test with default TTL
        cache = CacheLayer(redis_client=mock_redis)
        assert cache.ttl == 300  # 5 minutes default

    @pytest.mark.asyncio
    async def test_cache_performance(self, cache, mock_redis_client):
        """Test cache performance metrics."""
        # Test hit rate tracking
        cache._hits = 0
        cache._misses = 0
        
        # Simulate hits and misses
        mock_redis_client.get.return_value = json.dumps({"data": "test"})
        await cache.get("hit_key")
        assert cache._hits == 1
        
        mock_redis_client.get.return_value = None
        await cache.get("miss_key")
        assert cache._misses == 1
        
        # Calculate hit rate
        hit_rate = cache._hits / (cache._hits + cache._misses)
        assert hit_rate == 0.5