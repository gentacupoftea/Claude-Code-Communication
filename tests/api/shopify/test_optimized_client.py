"""
Tests for Optimized Shopify GraphQL Client
"""

import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch
import redis

from src.api.shopify.optimized_client import (
    OptimizedShopifyGraphQL,
    create_optimized_client
)
from src.api.shopify_graphql import ShopifyGraphQLError


class TestOptimizedShopifyGraphQL:
    """Test optimized GraphQL client"""
    
    @pytest.fixture
    async def optimized_client(self):
        """Create test optimized client"""
        client = OptimizedShopifyGraphQL(
            shop_url="https://test.myshopify.com",
            access_token="test_token",
            enable_batching=True,
            enable_caching=True,
            enable_rate_limiting=True
        )
        
        # Mock base client
        client.base_client.execute_query = AsyncMock()
        
        await client.start()
        yield client
        await client.stop()
    
    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client"""
        mock = Mock(spec=redis.Redis)
        mock.get.return_value = None
        mock.setex.return_value = True
        return mock
    
    @pytest.mark.asyncio
    async def test_initialization(self):
        """Test client initialization"""
        client = OptimizedShopifyGraphQL(
            shop_url="https://test.myshopify.com",
            access_token="test_token"
        )
        
        assert client.base_client is not None
        assert client.batch_processor is not None
        assert client.cache_manager is not None
        assert client.rate_limiter is not None
    
    @pytest.mark.asyncio
    async def test_execute_query_with_cache(self, optimized_client):
        """Test query execution with caching"""
        query = "query { shop { name } }"
        variables = {"test": "value"}
        expected_result = {"shop": {"name": "Test Shop"}}
        
        # First call - cache miss
        optimized_client.base_client.execute_query.return_value = expected_result
        
        result1 = await optimized_client.execute_query(
            query, variables, use_cache=True
        )
        
        assert result1 == expected_result
        assert optimized_client.metrics['cache_misses'] == 1
        
        # Second call - cache hit
        result2 = await optimized_client.execute_query(
            query, variables, use_cache=True
        )
        
        assert result2 == expected_result
        assert optimized_client.metrics['cache_hits'] == 1
        
        # Base client should only be called once
        assert optimized_client.base_client.execute_query.call_count == 1
    
    @pytest.mark.asyncio
    async def test_execute_query_with_batch(self, optimized_client):
        """Test query execution with batching"""
        queries = [
            ("query { orders { id } }", {"first": 10}),
            ("query { products { id } }", {"first": 10}),
            ("query { customers { id } }", {"first": 10})
        ]
        
        # Mock batch processor response
        optimized_client.batch_processor.add_query = AsyncMock()
        optimized_client.batch_processor.add_query.side_effect = [
            {"orders": [{"id": "1"}]},
            {"products": [{"id": "2"}]},
            {"customers": [{"id": "3"}]}
        ]
        
        # Execute queries
        tasks = []
        for query, variables in queries:
            task = optimized_client.execute_query(
                query, variables, use_batch=True, use_cache=False
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 3
        assert optimized_client.metrics['queries_batched'] == 3
    
    @pytest.mark.asyncio
    async def test_execute_query_with_rate_limit(self, optimized_client):
        """Test query execution with rate limiting"""
        query = "query { shop { name } }"
        expected_result = {"shop": {"name": "Test Shop"}}
        
        optimized_client.base_client.execute_query.return_value = expected_result
        
        # Execute query
        result = await optimized_client.execute_query(
            query, use_batch=False, use_cache=False
        )
        
        assert result == expected_result
        
        # Rate limiter should have been used
        state = optimized_client.rate_limiter.get_state()
        assert state['cost_available'] < optimized_client.rate_limiter.state.cost_limit
    
    @pytest.mark.asyncio
    async def test_error_handling(self, optimized_client):
        """Test error handling in query execution"""
        query = "query { error }"
        
        # Simulate GraphQL error
        error = ShopifyGraphQLError(
            "Query failed",
            errors=[{"message": "Field error"}],
            response=None
        )
        error.query_cost = 10
        
        optimized_client.base_client.execute_query.side_effect = error
        
        with pytest.raises(ShopifyGraphQLError):
            await optimized_client.execute_query(
                query, use_batch=False, use_cache=False
            )
        
        # Metrics should be updated
        assert optimized_client.metrics['errors'] == 1
        assert optimized_client.metrics['total_cost'] == 10
    
    @pytest.mark.asyncio
    async def test_optimized_query_methods(self, optimized_client):
        """Test optimized query methods"""
        # Test get_orders_optimized
        optimized_client.base_client.execute_query.return_value = {
            "orders": {"edges": []}
        }
        
        result = await optimized_client.get_orders_optimized(
            first=10,
            status="fulfilled"
        )
        
        assert "orders" in result
        
        # Check cache tags
        call_args = optimized_client.base_client.execute_query.call_args
        
        # Test get_products_optimized
        result = await optimized_client.get_products_optimized(first=10)
        assert "orders" in result  # Still using previous mock
        
        # Test get_customers_optimized
        result = await optimized_client.get_customers_optimized(first=10)
        assert "orders" in result  # Still using previous mock
    
    @pytest.mark.asyncio
    async def test_batch_operations(self, optimized_client):
        """Test batch operations"""
        order_ids = ["order1", "order2", "order3"]
        
        # Test with batching disabled
        optimized_client.batch_processor = None
        optimized_client.base_client.execute_query.return_value = {
            "order": {"id": "order1"}
        }
        
        results = await optimized_client.get_multiple_orders(order_ids)
        
        assert len(results) == 3
        assert optimized_client.base_client.execute_query.call_count == 3
        
        # Reset mock
        optimized_client.base_client.execute_query.reset_mock()
        
        # Test with batching enabled
        optimized_client.batch_processor = Mock()
        optimized_client.batch_processor.add_query = AsyncMock()
        optimized_client.batch_processor.add_query.return_value = {
            "order": {"id": "order1"}
        }
        
        results = await optimized_client.get_multiple_orders(order_ids)
        
        assert len(results) == 3
        assert optimized_client.batch_processor.add_query.call_count == 3
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, optimized_client):
        """Test cache invalidation"""
        # Add some cached data
        query = "query { orders { id } }"
        optimized_client.base_client.execute_query.return_value = {"orders": []}
        
        await optimized_client.execute_query(query, cache_tags=["orders"])
        
        # Invalidate by tag
        invalidated = await optimized_client.invalidate_cache(tags=["orders"])
        
        assert invalidated > 0
        
        # Next query should miss cache
        await optimized_client.execute_query(query)
        assert optimized_client.metrics['cache_misses'] == 2
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self, optimized_client):
        """Test metrics collection"""
        # Execute some queries
        query = "query { shop { name } }"
        optimized_client.base_client.execute_query.return_value = {"shop": {}}
        
        await optimized_client.execute_query(query)
        await optimized_client.execute_query(query)  # Cache hit
        await optimized_client.execute_query(query, use_cache=False)
        
        metrics = optimized_client.get_metrics()
        
        assert metrics['client']['queries_executed'] == 3
        assert metrics['client']['cache_hits'] == 1
        assert metrics['client']['cache_misses'] == 1
        
        # Component metrics
        assert 'batch' in metrics['components']
        assert 'cache' in metrics['components']
        assert 'rate_limit' in metrics['components']
    
    @pytest.mark.asyncio
    async def test_state_reporting(self, optimized_client):
        """Test system state reporting"""
        state = optimized_client.get_state()
        
        assert 'rate_limit' in state
        assert 'batch' in state
        
        # Check rate limit state
        assert 'cost_available' in state['rate_limit']
        assert 'usage_percentage' in state['rate_limit']
        
        # Check batch state
        assert 'queue_size' in state['batch']
        assert 'processing' in state['batch']
    
    @pytest.mark.asyncio
    async def test_priority_handling(self, optimized_client):
        """Test query priority handling"""
        query = "query { important { data } }"
        
        optimized_client.base_client.execute_query.return_value = {"important": {}}
        
        # High priority query
        result = await optimized_client.execute_query(
            query,
            priority=1,  # Highest priority
            use_cache=False
        )
        
        assert result == {"important": {}}
    
    @pytest.mark.asyncio
    async def test_cache_ttl_override(self, optimized_client):
        """Test cache TTL override"""
        query = "query { volatile { data } }"
        
        optimized_client.base_client.execute_query.return_value = {"volatile": {}}
        
        # Cache with short TTL
        await optimized_client.execute_query(
            query,
            cache_ttl=0.1  # 100ms
        )
        
        # Should hit cache immediately
        result = await optimized_client.execute_query(query)
        assert optimized_client.metrics['cache_hits'] == 1
        
        # Wait for expiration
        await asyncio.sleep(0.2)
        
        # Should miss cache
        result = await optimized_client.execute_query(query)
        assert optimized_client.metrics['cache_misses'] == 2


class TestClientFactory:
    """Test client factory function"""
    
    @patch.dict('os.environ', {'REDIS_URL': 'redis://localhost:6379'})
    def test_create_client_with_env(self):
        """Test client creation with environment variables"""
        client = create_optimized_client(
            shop_url="https://test.myshopify.com",
            access_token="test_token"
        )
        
        assert isinstance(client, OptimizedShopifyGraphQL)
        assert client.base_client is not None
        assert client.batch_processor is not None
        assert client.cache_manager is not None
        assert client.rate_limiter is not None
    
    def test_create_client_with_options(self):
        """Test client creation with custom options"""
        client = create_optimized_client(
            shop_url="https://test.myshopify.com",
            access_token="test_token",
            enable_batching=False,
            enable_caching=False,
            enable_rate_limiting=False
        )
        
        assert isinstance(client, OptimizedShopifyGraphQL)
        assert client.batch_processor is None
        assert client.cache_manager is None
        assert client.rate_limiter is None