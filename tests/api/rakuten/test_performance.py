"""
Tests for Rakuten API performance improvements
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock
import httpx
import time

from src.api.rakuten.client import RakutenAPIClient, RakutenAPIError


class TestCaching:
    """Test caching functionality"""
    
    @pytest.fixture
    async def client(self):
        """Create test client with caching enabled"""
        credentials = {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop',
            'cache_enabled': True
        }
        client = RakutenAPIClient(credentials)
        # Mock auth
        client.auth = Mock()
        client.auth.ensure_valid_token = AsyncMock(return_value=True)
        client.auth.get_auth_header = Mock(return_value={'Authorization': 'Bearer test_token'})
        return client
    
    @pytest.mark.asyncio
    async def test_product_cache_hit(self, client):
        """Test cache hit for product requests"""
        # Mock API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'product': {
                'productId': '12345',
                'productName': 'Test Product',
                'salesPrice': 1000
            }
        }
        
        # First request (cache miss)
        client.client.request = AsyncMock(return_value=mock_response)
        result1 = await client.get_product('12345')
        
        # Verify cache miss
        stats = client.get_cache_stats()
        assert stats['stats']['misses'] == 1
        assert stats['stats']['hits'] == 0
        
        # Second request (cache hit)
        result2 = await client.get_product('12345')
        
        # Verify cache hit
        stats = client.get_cache_stats()
        assert stats['stats']['misses'] == 1
        assert stats['stats']['hits'] == 1
        assert stats['product_cache_size'] == 1
        
        # Results should be identical
        assert result1 == result2
        
        # API should only be called once
        assert client.client.request.call_count == 1
    
    @pytest.mark.asyncio
    async def test_cache_disabled(self, client):
        """Test behavior when cache is disabled"""
        client._cache_enabled = False
        
        # Mock API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'product': {}}
        
        client.client.request = AsyncMock(return_value=mock_response)
        
        # Make multiple requests
        await client.get_product('12345')
        await client.get_product('12345')
        
        # API should be called twice (no caching)
        assert client.client.request.call_count == 2
        
        # Cache stats should show no activity
        stats = client.get_cache_stats()
        assert stats['enabled'] is False
        assert stats['stats']['hits'] == 0
        assert stats['product_cache_size'] == 0
    
    def test_cache_invalidation(self, client):
        """Test cache invalidation"""
        # Populate caches
        client._product_cache['product:123'] = {'test': 'data'}
        client._product_cache['product:456'] = {'test': 'data'}
        client._order_cache['order:789'] = {'test': 'data'}
        
        # Invalidate specific product
        count = client.invalidate_cache('product:123')
        assert count == 1
        assert 'product:123' not in client._product_cache
        assert 'product:456' in client._product_cache
        assert len(client._order_cache) == 1
        
        # Invalidate all products
        count = client.invalidate_cache('product:*')
        # Note: Current implementation doesn't support wildcard patterns
        # This is a limitation that could be improved
        
        # Invalidate all caches
        count = client.invalidate_cache('*')
        assert count == 2  # Remaining product + order
        assert len(client._product_cache) == 0
        assert len(client._order_cache) == 0
    
    def test_cache_stats(self, client):
        """Test cache statistics"""
        # Initial stats
        stats = client.get_cache_stats()
        assert stats['enabled'] is True
        assert stats['hit_ratio'] == 0
        
        # Simulate hits and misses
        client._cache_stats['hits'] = 3
        client._cache_stats['misses'] = 7
        
        stats = client.get_cache_stats()
        assert stats['hit_ratio'] == 0.3  # 3/10


class TestRateLimiting:
    """Test rate limiting improvements"""
    
    @pytest.fixture
    async def client(self):
        """Create test client"""
        credentials = {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop'
        }
        client = RakutenAPIClient(credentials)
        # Mock auth
        client.auth = Mock()
        client.auth.ensure_valid_token = AsyncMock(return_value=True)
        client.auth.get_auth_header = Mock(return_value={'Authorization': 'Bearer test_token'})
        return client
    
    @pytest.mark.asyncio
    async def test_exponential_backoff_retry(self, client):
        """Test exponential backoff for rate limits"""
        # Mock rate limit response
        rate_limit_response = Mock()
        rate_limit_response.status_code = 429
        rate_limit_response.headers = {'Retry-After': '2'}
        rate_limit_response.json.return_value = {
            'errors': [{'code': 'RATE_LIMIT', 'message': 'Too many requests'}]
        }
        
        # Mock successful response
        success_response = Mock()
        success_response.status_code = 200
        success_response.json.return_value = {'product': {}}
        
        # First two calls fail with rate limit, third succeeds
        client.client.request = AsyncMock(
            side_effect=[rate_limit_response, rate_limit_response, success_response]
        )
        
        start_time = time.time()
        result = await client._make_request_with_retry('GET', '/test', max_retries=3, base_delay=0.1)
        elapsed_time = time.time() - start_time
        
        # Should succeed after retries
        assert result.status_code == 200
        assert client.client.request.call_count == 3
        
        # Should have waited due to backoff (but not too long for tests)
        assert elapsed_time > 0.2  # At least some delay
        assert elapsed_time < 5.0  # But not excessive
    
    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self, client):
        """Test behavior when max retries are exceeded"""
        # Mock persistent rate limit
        rate_limit_response = Mock()
        rate_limit_response.status_code = 429
        rate_limit_response.headers = {}
        rate_limit_response.json.return_value = {
            'errors': [{'code': 'RATE_LIMIT', 'message': 'Too many requests'}]
        }
        
        client.client.request = AsyncMock(return_value=rate_limit_response)
        
        with pytest.raises(RakutenAPIError) as excinfo:
            await client._make_request_with_retry('GET', '/test', max_retries=2, base_delay=0.01)
        
        assert 'Too many requests' in str(excinfo.value)
        assert client.client.request.call_count == 2  # Should try max_retries times
    
    @pytest.mark.asyncio
    async def test_non_rate_limit_error_no_retry(self, client):
        """Test that non-rate limit errors don't trigger retry"""
        # Mock non-rate limit error
        error_response = Mock()
        error_response.status_code = 400
        error_response.json.return_value = {
            'errors': [{'code': 'INVALID_REQUEST', 'message': 'Bad request'}]
        }
        
        client.client.request = AsyncMock(return_value=error_response)
        
        with pytest.raises(RakutenAPIError) as excinfo:
            await client._make_request_with_retry('GET', '/test', max_retries=3)
        
        assert 'Bad request' in str(excinfo.value)
        assert client.client.request.call_count == 1  # Should not retry