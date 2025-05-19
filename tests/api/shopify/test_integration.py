"""
Integration tests for Shopify GraphQL optimizations
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, AsyncMock

from src.api.shopify.optimized_client import OptimizedShopifyGraphQL
from src.api.shopify_graphql import ShopifyGraphQLError


class TestGraphQLOptimizationIntegration:
    """Test all optimization components working together"""
    
    @pytest.fixture
    async def client(self):
        """Create fully configured client"""
        client = OptimizedShopifyGraphQL(
            shop_url="https://test.myshopify.com",
            access_token="test_token",
            enable_batching=True,
            enable_caching=True,
            enable_rate_limiting=True
        )
        
        # Mock base client with realistic responses
        client.base_client.execute_query = AsyncMock()
        client.base_client.client = Mock()
        client.base_client.client.last_response = Mock()
        client.base_client.client.last_response.headers = {
            'X-Shopify-API-Call-Limit': '40/100'
        }
        
        await client.start()
        yield client
        await client.stop()
    
    @pytest.mark.asyncio
    async def test_end_to_end_optimization(self, client):
        """Test complete optimization flow"""
        # Prepare mock responses
        orders_response = {
            "orders": {
                "edges": [
                    {"node": {"id": "1", "totalPrice": "100.00"}},
                    {"node": {"id": "2", "totalPrice": "200.00"}}
                ],
                "pageInfo": {"hasNextPage": False}
            }
        }
        
        products_response = {
            "products": {
                "edges": [
                    {"node": {"id": "1", "title": "Product 1"}},
                    {"node": {"id": "2", "title": "Product 2"}}
                ]
            }
        }
        
        # Configure mock to return different responses
        response_map = {
            "orders": orders_response,
            "products": products_response
        }
        
        async def mock_execute(query, variables=None):
            # Simple pattern matching
            if "orders" in query:
                return orders_response
            elif "products" in query:
                return products_response
            else:
                return {"data": {}}
        
        client.base_client.execute_query = mock_execute
        
        # Test 1: Execute multiple queries (should be batched)
        start_time = time.time()
        
        tasks = []
        for i in range(5):
            tasks.append(client.get_orders_optimized(first=10))
            tasks.append(client.get_products_optimized(first=10))
        
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Verify results
        assert len(results) == 10
        assert all("orders" in r or "products" in r for r in results)
        
        # Check metrics
        metrics = client.get_metrics()
        
        # Should have cache hits (repeated queries)
        assert metrics['client']['cache_hits'] > 0
        
        # Should have batched queries
        assert metrics['client']['queries_batched'] > 0
        
        # Test 2: Rate limiting behavior
        # Simulate hitting rate limit
        client.rate_limiter.state.cost_available = 5  # Very low
        
        async def rate_limited_query():
            return await client.execute_query(
                "query { expensive { data } }",
                use_cache=False
            )
        
        # These should be throttled
        throttled_tasks = [rate_limited_query() for _ in range(3)]
        
        start_time = time.time()
        await asyncio.gather(*throttled_tasks, return_exceptions=True)
        throttle_time = time.time() - start_time
        
        # Should take longer due to rate limiting
        assert throttle_time > 0.1
        
        # Test 3: Cache invalidation
        # Invalidate orders cache
        await client.invalidate_cache(tags=["orders"])
        
        # Next orders query should miss cache
        initial_misses = metrics['client']['cache_misses']
        await client.get_orders_optimized(first=10)
        
        updated_metrics = client.get_metrics()
        assert updated_metrics['client']['cache_misses'] > initial_misses
    
    @pytest.mark.asyncio
    async def test_performance_improvement(self, client):
        """Test actual performance improvements"""
        # Configure realistic mock behavior
        query_count = 0
        
        async def mock_execute_with_delay(query, variables=None):
            nonlocal query_count
            query_count += 1
            
            # Simulate network delay
            await asyncio.sleep(0.05)
            
            return {"data": {"result": f"query_{query_count}"}}
        
        client.base_client.execute_query = mock_execute_with_delay
        
        # Test 1: Without optimizations
        client.batch_processor = None
        client.cache_manager = None
        
        start_time = time.time()
        
        # Execute 10 identical queries
        tasks = []
        for i in range(10):
            tasks.append(client.execute_query("query { test }"))
        
        results = await asyncio.gather(*tasks)
        
        no_opt_time = time.time() - start_time
        no_opt_query_count = query_count
        
        # Reset
        query_count = 0
        
        # Test 2: With optimizations
        # Re-enable optimizations
        from src.api.shopify.batch_processor import GraphQLBatchProcessor
        from src.api.shopify.cache_manager import GraphQLCacheManager
        
        client.batch_processor = GraphQLBatchProcessor(client)
        client.cache_manager = GraphQLCacheManager()
        
        await client.batch_processor.start()
        
        start_time = time.time()
        
        # Execute same queries
        tasks = []
        for i in range(10):
            tasks.append(client.execute_query("query { test }"))
        
        results = await asyncio.gather(*tasks)
        
        opt_time = time.time() - start_time
        opt_query_count = query_count
        
        await client.batch_processor.stop()
        
        # Verify improvements
        assert opt_time < no_opt_time  # Should be faster
        assert opt_query_count < no_opt_query_count  # Fewer actual queries
        
        # Calculate improvement
        time_improvement = (no_opt_time - opt_time) / no_opt_time * 100
        query_reduction = (no_opt_query_count - opt_query_count) / no_opt_query_count * 100
        
        print(f"Time improvement: {time_improvement:.1f}%")
        print(f"Query reduction: {query_reduction:.1f}%")
    
    @pytest.mark.asyncio
    async def test_error_handling_cascade(self, client):
        """Test error handling across all components"""
        # Configure error responses
        error_count = 0
        
        async def mock_execute_with_errors(query, variables=None):
            nonlocal error_count
            error_count += 1
            
            if error_count <= 2:
                # First few attempts fail
                raise ShopifyGraphQLError(
                    "Rate limit exceeded",
                    errors=[{"message": "Too many requests"}]
                )
            else:
                # Eventually succeed
                return {"data": {"success": True}}
        
        client.base_client.execute_query = mock_execute_with_errors
        
        # Execute query - should retry and eventually succeed
        result = await client.execute_query(
            "query { test }",
            use_cache=False
        )
        
        assert result == {"data": {"success": True}}
        assert error_count > 1  # Should have retried
        
        # Check that error was properly tracked
        metrics = client.get_metrics()
        assert metrics['client']['errors'] > 0
    
    @pytest.mark.asyncio
    async def test_concurrent_load(self, client):
        """Test system under concurrent load"""
        # Configure mock for concurrent access
        concurrent_requests = 0
        max_concurrent = 0
        
        async def mock_concurrent_execute(query, variables=None):
            nonlocal concurrent_requests, max_concurrent
            
            concurrent_requests += 1
            max_concurrent = max(max_concurrent, concurrent_requests)
            
            # Simulate processing time
            await asyncio.sleep(0.01)
            
            concurrent_requests -= 1
            
            return {"data": {"id": str(time.time())}}
        
        client.base_client.execute_query = mock_concurrent_execute
        
        # Generate high concurrent load
        tasks = []
        for i in range(50):
            tasks.append(client.execute_query(
                f"query {{ item{i} {{ id }} }}",
                use_cache=False,
                use_batch=True if i % 2 == 0 else False
            ))
        
        results = await asyncio.gather(*tasks)
        
        # Verify all completed
        assert len(results) == 50
        assert all("data" in r for r in results)
        
        # Check concurrency was controlled
        assert max_concurrent <= 10  # Should be limited by semaphore
        
        # Check final state
        state = client.get_state()
        assert state['batch']['queue_size'] == 0
        assert state['batch']['pending_requests'] == 0
    
    @pytest.mark.asyncio
    async def test_cache_hierarchy(self, client):
        """Test multi-level cache hierarchy"""
        # Mock Redis for L2 cache
        mock_redis = Mock()
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = True
        
        # Configure L2 cache
        from src.api.shopify.cache_manager import RedisCache
        client.cache_manager.redis_cache = RedisCache(mock_redis)
        client.cache_manager.levels.append(client.cache_manager.redis_cache)
        
        # Execute query - should cache in both levels
        query = "query { cached { data } }"
        result = {"cached": {"data": "test"}}
        
        client.base_client.execute_query = AsyncMock(return_value=result)
        
        # First execution - cache miss
        result1 = await client.execute_query(query)
        assert result1 == result
        
        # Verify cached in Redis (L2)
        assert mock_redis.setex.called
        
        # Clear L1 cache
        client.cache_manager.memory_cache.clear()
        
        # Configure Redis to return cached value
        import json
        mock_redis.get.return_value = json.dumps({
            "value": result,
            "timestamp": time.time(),
            "tags": []
        }).encode()
        
        # Second execution - should hit L2 cache
        result2 = await client.execute_query(query)
        assert result2 == result
        
        # Should promote to L1
        l1_result = client.cache_manager.memory_cache.get(
            client.cache_manager.generate_key(query)
        )
        assert l1_result == result