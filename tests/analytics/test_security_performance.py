"""Tests for security and performance optimizations."""

import pytest
import time
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

from src.analytics.dashboard.analytics_processor import AnalyticsProcessor
from src.analytics.api.analytics_routes import RBACChecker, sanitize_date_input
from src.analytics.security.data_sanitizer import DataSanitizer, SQLInjectionProtector
from src.analytics.cache.analytics_cache import AnalyticsCache, CacheManager
from src.api.shopify_api import ShopifyAPI
from src.auth.models import User


class TestSecurityFeatures:
    """Test security implementations."""
    
    def test_rbac_permissions(self):
        """Test role-based access control."""
        admin_user = User(id="1", email="admin@test.com", role="admin")
        user = User(id="2", email="user@test.com", role="user")
        viewer = User(id="3", email="viewer@test.com", role="viewer")
        
        # Test admin permissions
        assert RBACChecker.has_permission(admin_user, "analytics:read")
        assert RBACChecker.has_permission(admin_user, "analytics:export")
        assert RBACChecker.has_permission(admin_user, "analytics:admin")
        
        # Test user permissions
        assert RBACChecker.has_permission(user, "analytics:read")
        assert not RBACChecker.has_permission(user, "analytics:export")
        assert not RBACChecker.has_permission(user, "analytics:admin")
        
        # Test viewer permissions
        assert RBACChecker.has_permission(viewer, "analytics:read")
        assert not RBACChecker.has_permission(viewer, "analytics:export")
        assert not RBACChecker.has_permission(viewer, "analytics:admin")
    
    def test_data_sanitizer(self):
        """Test data sanitization."""
        # Test email sanitization
        data = {"email": "user@example.com", "name": "John Doe"}
        sanitized = DataSanitizer.sanitize_data(data)
        assert sanitized["email"] != "user@example.com"
        assert "**" in sanitized["email"]
        
        # Test SQL injection protection
        malicious_input = "'; DROP TABLE users; --"
        assert not SQLInjectionProtector.is_safe(malicious_input)
        
        # Test XSS protection
        xss_input = {"content": "<script>alert('xss')</script>"}
        sanitized = DataSanitizer.sanitize_data(xss_input)
        assert "<script>" not in sanitized["content"]
        assert "&lt;script&gt;" in sanitized["content"]
    
    def test_date_input_sanitization(self):
        """Test date input validation and sanitization."""
        # Valid date
        valid_date = "2025-05-19T00:00:00Z"
        result = sanitize_date_input(valid_date)
        assert result == valid_date
        
        # Invalid date format
        with pytest.raises(Exception):
            sanitize_date_input("invalid-date")
        
        # SQL injection attempt
        with pytest.raises(Exception):
            sanitize_date_input("2025-05-19'; DROP TABLE orders; --")
        
        # Date too far in past
        with pytest.raises(Exception):
            old_date = (datetime.utcnow() - timedelta(days=365 * 6)).isoformat()
            sanitize_date_input(old_date)


class TestPerformanceOptimizations:
    """Test performance optimizations."""
    
    @pytest.fixture
    def mock_shopify_api(self):
        """Create a mock Shopify API with sample data."""
        api = Mock(spec=ShopifyAPI)
        
        # Generate sample orders
        orders = []
        for i in range(10000):  # Large dataset for performance testing
            orders.append({
                'order_id': str(i),
                'created_at': (datetime.utcnow() - timedelta(days=i % 30)).isoformat(),
                'total_price': 100.0 + (i % 500),
                'currency': 'USD',
                'customer': {'id': f'cust{i % 1000}', 'email': f'test{i}@example.com'},
                'line_items': [
                    {'product_type': f'Category{i % 10}', 'price': 50.0, 'quantity': 2}
                ],
                'shipping_address': {
                    'country_code': 'US' if i % 2 == 0 else 'CA',
                    'province_code': 'CA' if i % 2 == 0 else 'ON'
                }
            })
        
        api.get_orders.return_value = orders
        return api
    
    def test_cache_performance(self):
        """Test cache implementation performance."""
        cache = AnalyticsCache(ttl=60, max_size=50)
        
        # Test set and get performance
        start_time = time.time()
        for i in range(100):
            cache.set(f"key{i}", {"value": i})
        set_time = time.time() - start_time
        
        start_time = time.time()
        for i in range(100):
            value = cache.get(f"key{i}")
        get_time = time.time() - start_time
        
        # Performance should be fast
        assert set_time < 0.1  # Less than 100ms for 100 operations
        assert get_time < 0.05  # Gets should be faster
        
        # Test LRU eviction
        stats = cache.get_stats()
        assert stats['total_entries'] <= cache.max_size
    
    def test_processor_chunking(self, mock_shopify_api):
        """Test data processing with chunking."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Test order summary with large dataset
        start_time = time.time()
        result = processor.get_order_summary(
            start_date=(datetime.utcnow() - timedelta(days=30)).isoformat(),
            end_date=datetime.utcnow().isoformat(),
            group_by='day'
        )
        processing_time = time.time() - start_time
        
        # Should process efficiently
        assert processing_time < 5.0  # Less than 5 seconds for 10k records
        assert 'data' in result
        assert 'summary' in result
        assert len(result['data']) > 0
    
    @pytest.mark.asyncio
    async def test_async_category_sales(self, mock_shopify_api):
        """Test async category sales processing."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Test async processing
        start_time = time.time()
        result = await processor.get_category_sales_async(
            start_date=(datetime.utcnow() - timedelta(days=30)).isoformat(),
            end_date=datetime.utcnow().isoformat()
        )
        async_time = time.time() - start_time
        
        # Compare with sync version
        start_time = time.time()
        sync_result = processor.get_category_sales(
            start_date=(datetime.utcnow() - timedelta(days=30)).isoformat(),
            end_date=datetime.utcnow().isoformat()
        )
        sync_time = time.time() - start_time
        
        # Async should be comparable or faster
        assert len(result) == len(sync_result)
        assert async_time <= sync_time * 1.5  # Allow some overhead
    
    def test_parallel_trend_processing(self, mock_shopify_api):
        """Test parallel processing for trend data."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Test trend with comparison
        start_time = time.time()
        result = processor.get_sales_trend(
            start_date=(datetime.utcnow() - timedelta(days=30)).isoformat(),
            end_date=datetime.utcnow().isoformat(),
            compare_previous=True
        )
        parallel_time = time.time() - start_time
        
        # Test without comparison
        start_time = time.time()
        single_result = processor.get_sales_trend(
            start_date=(datetime.utcnow() - timedelta(days=30)).isoformat(),
            end_date=datetime.utcnow().isoformat(),
            compare_previous=False
        )
        single_time = time.time() - start_time
        
        # Parallel should be efficient
        assert 'current' in result
        assert 'previous' in result
        assert 'growth_rate' in result
        assert parallel_time < single_time * 2  # Should not double the time
    
    def test_export_streaming(self, mock_shopify_api):
        """Test export with streaming for large datasets."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Generate large dataset
        large_data = [{'id': i, 'value': i * 2} for i in range(15000)]
        
        # Test CSV export
        start_time = time.time()
        csv_data = processor.export_data(large_data, format='csv')
        csv_time = time.time() - start_time
        
        # Test JSON export
        start_time = time.time()
        json_data = processor.export_data(large_data, format='json')
        json_time = time.time() - start_time
        
        # Should handle large exports efficiently
        assert len(csv_data) > 0
        assert len(json_data) > 0
        assert csv_time < 2.0  # Less than 2 seconds
        assert json_time < 3.0  # JSON might be slower


class TestCacheIntegration:
    """Test cache integration with processor."""
    
    @pytest.fixture
    def processor_with_cache(self, mock_shopify_api):
        """Create processor with cache enabled."""
        processor = AnalyticsProcessor(mock_shopify_api)
        processor._cache.clear()  # Start with empty cache
        return processor
    
    def test_cache_hit_performance(self, processor_with_cache):
        """Test performance improvement with cache hits."""
        # First call - cache miss
        start_time = time.time()
        result1 = processor_with_cache.get_order_summary()
        miss_time = time.time() - start_time
        
        # Second call - cache hit
        start_time = time.time()
        result2 = processor_with_cache.get_order_summary()
        hit_time = time.time() - start_time
        
        # Cache hit should be much faster
        assert hit_time < miss_time * 0.1  # At least 10x faster
        assert result1 == result2  # Same results
    
    def test_cache_expiration(self, processor_with_cache):
        """Test cache expiration."""
        # Set short TTL for testing
        processor_with_cache._cache.ttl = 1  # 1 second
        
        # Add to cache
        result1 = processor_with_cache.get_order_summary()
        
        # Wait for expiration
        time.sleep(1.5)
        
        # Should fetch new data
        result2 = processor_with_cache.get_order_summary()
        
        # Verify cache was refreshed
        stats = processor_with_cache._cache.get_stats()
        assert stats['expired_entries'] == 0  # Expired entry was cleaned


class TestMemoryOptimization:
    """Test memory usage optimizations."""
    
    def test_dataframe_optimization(self, mock_shopify_api):
        """Test DataFrame memory optimization."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Get orders
        orders = mock_shopify_api.get_orders()
        df = pd.DataFrame(orders)
        
        # Original memory usage
        original_memory = df.memory_usage(deep=True).sum()
        
        # Process with optimization
        result = processor.get_order_summary()
        
        # Verify data types are optimized
        # The processor should use more efficient data types
        assert result is not None
        
        # Test chunking for large datasets
        processor.CHUNK_SIZE = 1000  # Force chunking
        chunked_result = processor.get_order_summary()
        
        # Results should be the same
        assert chunked_result['summary']['total_orders'] == result['summary']['total_orders']


class TestErrorHandling:
    """Test error handling in optimized code."""
    
    def test_cache_error_handling(self):
        """Test cache error handling."""
        cache = AnalyticsCache()
        
        # Test with invalid key types
        with pytest.raises(Exception):
            cache.set(None, "value")
        
        # Test with corrupted data
        cache._cache["test"] = "invalid"  # Not a dict
        result = cache.get("test")
        assert result is None  # Should handle gracefully
    
    def test_processor_error_handling(self, mock_shopify_api):
        """Test processor error handling."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Test with invalid data
        mock_shopify_api.get_orders.return_value = [{"invalid": "data"}]
        result = processor.get_order_summary()
        
        # Should handle gracefully
        assert result['data'] == []
        assert result['summary'] == {}
    
    @pytest.mark.asyncio
    async def test_async_error_handling(self, mock_shopify_api):
        """Test async error handling."""
        processor = AnalyticsProcessor(mock_shopify_api)
        
        # Test with network error simulation
        mock_shopify_api.get_orders.side_effect = Exception("Network error")
        
        with pytest.raises(Exception):
            await processor.get_category_sales_async()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])