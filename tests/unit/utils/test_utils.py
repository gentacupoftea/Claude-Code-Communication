import pytest
import unittest.mock as mock
import os
import sys
import time
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock, call

# Add the root directory to sys.path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

# Import utility functions
from utils import (
    memoize, clear_cache, clear_cache_for_function, optimize_dataframe_dtypes,
    RateLimiter, CacheManager, CacheEntry, CacheStats
)

@pytest.mark.unit
class TestMemoize:
    
    def test_memoize_caching(self):
        """Test that memoize caches function results"""
        # Create a simple function with the memoize decorator
        @memoize(ttl=60)
        def test_function(arg1, arg2=None):
            return {"result": arg1 + str(arg2)}
        
        # Call it with the same arguments
        result1 = test_function("test", arg2=123)
        result2 = test_function("test", arg2=123)
        
        # Results should be identical
        assert result1 == result2
        assert result1 == {"result": "test123"}
    
    def test_memoize_different_args(self):
        """Test that memoize caches separate results for different arguments"""
        # Mock function to track calls
        mock_func = MagicMock(return_value="result")
        
        # Apply the memoize decorator
        memoized_func = memoize(ttl=60)(mock_func)
        
        # Call with different arguments
        memoized_func("arg1")
        memoized_func("arg2")
        
        # Should be called twice with different args
        assert mock_func.call_count == 2
    
    def test_clear_cache(self):
        """Test clearing the entire cache"""
        # Define a test function
        @memoize(ttl=60)
        def test_function(arg):
            return {"result": arg}
        
        # Call it to populate the cache
        result1 = test_function("test")
        
        # Clear the cache
        clear_cache()
        
        # Create a mock to track function calls
        with patch('utils.get_cache_key', return_value="test_key"), \
             patch('utils.cache_manager.get', return_value=None) as mock_get, \
             patch('utils.cache_manager.set') as mock_set:
            
            # Call again with the same args
            result2 = test_function("test")
            
            # Cache get should be called and return None
            mock_get.assert_called_once()
            # Set should be called to store the new result
            mock_set.assert_called_once()
    
    def test_clear_cache_for_function(self):
        """Test clearing cache for a specific function"""
        # Define test functions
        @memoize(ttl=60)
        def func1(arg):
            return {"result": arg}
        
        @memoize(ttl=60)
        def func2(arg):
            return {"result": arg}
        
        # Call both to populate cache
        result1 = func1("test")
        result2 = func2("test")
        
        # Mock cache operations to verify
        with patch('utils.cache_manager.clear_for_function') as mock_clear:
            # Clear only func1's cache
            clear_cache_for_function("func1")
            
            # Verify correct function was cleared
            mock_clear.assert_called_once_with("func1")


@pytest.mark.unit
class TestDataFrameOptimization:
    
    def test_optimize_dataframe_dtypes(self):
        """Test dataframe memory optimization"""
        # Create a test dataframe
        df = pd.DataFrame({
            'float_col': np.array([1.1, 2.2, 3.3], dtype='float64'),
            'int_col': np.array([1, 2, 3], dtype='int64'),
            'object_col': ['a', 'b', 'c'],
            'category_col': ['cat1', 'cat2', 'cat1']
        })
        
        # Optimize it
        optimized_df = optimize_dataframe_dtypes(df)
        
        # Check datatypes are optimized
        assert optimized_df['float_col'].dtype == 'float32'
        assert optimized_df['int_col'].dtype == 'int32'
        # Category column with few unique values should be converted
        assert optimized_df['category_col'].dtype.name == 'category'


@pytest.mark.unit
class TestRateLimiter:
    
    def test_init(self):
        """Test RateLimiter initialization"""
        limiter = RateLimiter(
            requests_per_second=5.0,
            max_burst=20,
            backoff_factor=2.0,
            max_backoff=60.0,
            enable_log=False
        )
        
        assert limiter.requests_per_second == 5.0
        assert limiter.request_interval == 0.2  # 1/5
        assert limiter.max_burst == 20
        assert limiter.backoff_factor == 2.0
        assert limiter.max_backoff == 60.0
        assert limiter.enable_log is False
    
    def test_wait_under_limit(self):
        """Test wait doesn't block when under limit"""
        limiter = RateLimiter(
            requests_per_second=100.0,  # High limit to avoid actual waiting
            enable_log=False
        )
        
        # Record start time
        start = time.time()
        
        # Call wait multiple times, should return quickly
        for _ in range(5):
            limiter.wait()
        
        duration = time.time() - start
        
        # Should be very quick, but add small buffer for slow systems
        assert duration < 0.1, f"Wait took too long: {duration}s"
    
    def test_rate_limiter_decorator(self):
        """Test rate limiter as a decorator"""
        limiter = RateLimiter(
            requests_per_second=100.0,  # High limit to avoid actual waiting
            enable_log=False
        )
        
        # Define a function using the rate limiter
        @limiter
        def test_function():
            return "result"
        
        # Call it a few times
        results = [test_function() for _ in range(5)]
        
        # All calls should succeed
        assert all(result == "result" for result in results)
        
        # Verify stats
        stats = limiter.get_stats()
        assert stats["total_requests"] == 5
        assert stats["throttled_requests"] == 0
    
    def test_get_stats(self):
        """Test getting stats from rate limiter"""
        limiter = RateLimiter(enable_log=False)
        
        # Make some requests
        for _ in range(3):
            limiter.wait()
        
        # Get stats
        stats = limiter.get_stats()
        
        # Verify basic stats structure
        assert "total_requests" in stats
        assert "throttled_requests" in stats
        assert "throttle_rate" in stats
        assert "current_backoff" in stats
        assert "consecutive_throttles" in stats
        assert "average_retry_count" in stats
        assert "recent_requests_per_second" in stats
        assert "max_requests_per_second" in stats
        
        # Verify values
        assert stats["total_requests"] == 3
        assert stats["throttled_requests"] >= 0
        assert 0 <= stats["throttle_rate"] <= 1


@pytest.mark.unit
class TestCacheManager:
    
    def test_init(self):
        """Test CacheManager initialization"""
        manager = CacheManager(
            max_size=500,
            max_memory_mb=50,
            default_ttl=120,
            strategy="lru"
        )
        
        # Verify init values via stats
        stats = manager.get_stats()
        assert stats.hits == 0
        assert stats.misses == 0
        assert stats.hit_rate == 0
        assert stats.size == 0
        assert stats.memory_usage_bytes == 0
        assert stats.memory_usage_mb == 0
        assert stats.entry_count == 0
        assert stats.evictions == 0
    
    def test_set_and_get(self):
        """Test setting and getting cache values"""
        manager = CacheManager(strategy="lru")
        
        # Set a value
        manager.set("test_key", "test_value")
        
        # Get the value
        value = manager.get("test_key")
        
        assert value == "test_value"
        
        # Verify stats
        stats = manager.get_stats()
        assert stats.hits == 1
        assert stats.misses == 0
        assert stats.hit_rate == 1.0
        assert stats.size == 1
    
    def test_ttl_expiration(self):
        """Test that cache entries expire after TTL"""
        manager = CacheManager(default_ttl=1)  # 1 second TTL
        
        # Set a value
        manager.set("test_key", "test_value")
        
        # Get immediately should work
        assert manager.get("test_key") == "test_value"
        
        # Wait for TTL to expire
        time.sleep(1.1)
        
        # Should be gone now
        assert manager.get("test_key") is None
        
        # Verify stats
        stats = manager.get_stats()
        assert stats.hits == 1
        assert stats.misses == 1
        assert stats.hit_rate == 0.5
    
    def test_clear(self):
        """Test clearing the cache"""
        manager = CacheManager()
        
        # Set multiple values
        manager.set("key1", "value1")
        manager.set("key2", "value2")
        
        # Clear all
        manager.clear()
        
        # Should all be gone
        assert manager.get("key1") is None
        assert manager.get("key2") is None
        
        # Verify stats
        stats = manager.get_stats()
        assert stats.size == 0
        assert stats.memory_usage_bytes == 0
    
    def test_clear_for_function(self):
        """Test clearing cache for specific function"""
        manager = CacheManager()
        
        # Set values with function prefixes
        manager.set("func1_key1", "value1")
        manager.set("func1_key2", "value2")
        manager.set("func2_key1", "value3")
        
        # Clear only func1 entries
        manager.clear_for_function("func1")
        
        # func1 entries should be gone
        assert manager.get("func1_key1") is None
        assert manager.get("func1_key2") is None
        
        # func2 entries should remain
        assert manager.get("func2_key1") == "value3"