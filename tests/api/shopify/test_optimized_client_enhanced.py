"""
Enhanced tests for the Optimized Shopify GraphQL Client
Testing the new fragment library, query optimizer, and enhanced batch processing
"""

import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch

from src.api.shopify.optimized_client import OptimizedShopifyGraphQL
from src.api.shopify.fragment_library import fragment_library
from src.api.shopify.query_optimizer import query_optimizer
from src.api.errors import ShopifyGraphQLError, ShopifyRateLimitError


@pytest.mark.asyncio
class TestOptimizedClientEnhancements:
    """Test optimized client with enhanced components"""
    
    @pytest.fixture
    async def enhanced_client(self):
        """Create optimized client with real components for testing"""
        client = OptimizedShopifyGraphQL(
            shop_url="https://test.myshopify.com",
            access_token="test_token",
            redis_url=None
        )
        
        # Mock base client execute_query
        client.base_client.execute_query = AsyncMock()
        client.base_client.execute_query.return_value = {"test": "data"}
        
        # Keep real fragment library and query optimizer
        client.fragment_library = fragment_library
        client.query_optimizer = query_optimizer
        
        await client.start()
        yield client
        await client.stop()
    
    async def test_execute_query_with_optimization(self, enhanced_client):
        """Test query execution with optimization"""
        # Original query without fragments
        query = """
        query {
          orders(first: 100) {
            edges {
              node {
                id
                name
                totalPrice
                currencyCode
                displayFinancialStatus
                lineItems(first: 80) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        # Execute with optimization
        await enhanced_client.execute_query(
            query=query,
            use_cache=False,
            use_batch=False,
            optimize_query=True
        )
        
        # Check that optimized query was passed to base client
        call_args = enhanced_client.base_client.execute_query.call_args
        optimized_query = call_args[1]["query"]
        
        # Optimized query should contain fragments and optimized page sizes
        assert "fragment " in optimized_query
        assert "first: 50" in optimized_query  # Optimized from 100
    
    async def test_execute_query_without_optimization(self, enhanced_client):
        """Test query execution with optimization disabled"""
        query = "query { shop { name } }"
        
        # Execute without optimization
        await enhanced_client.execute_query(
            query=query,
            optimize_query=False
        )
        
        # Original query should be passed unchanged
        call_args = enhanced_client.base_client.execute_query.call_args
        passed_query = call_args[1]["query"]
        assert passed_query == query
    
    async def test_get_orders_optimized_with_fragments(self, enhanced_client):
        """Test optimized order query with fragments"""
        # Mock response
        enhanced_client.base_client.execute_query.return_value = {
            "orders": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/Order/123",
                            "name": "#1001"
                        }
                    }
                ]
            }
        }
        
        # Call optimized method
        result = await enhanced_client.get_orders_optimized(
            first=10,
            fields=["lineItems", "customer"]
        )
        
        # Verify result
        assert result == enhanced_client.base_client.execute_query.return_value
        
        # Check that fragment was used
        call_args = enhanced_client.base_client.execute_query.call_args
        query = call_args[1]["query"]
        assert "fragment OrderWithLineItems on Order" in query
    
    async def test_get_products_optimized_with_fragments(self, enhanced_client):
        """Test optimized product query with fragments"""
        # Mock response
        enhanced_client.base_client.execute_query.return_value = {
            "products": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/Product/123",
                            "title": "Test Product"
                        }
                    }
                ]
            }
        }
        
        # Call optimized method with specific fields
        result = await enhanced_client.get_products_optimized(
            first=10,
            fields=["images"]
        )
        
        # Verify result
        assert result == enhanced_client.base_client.execute_query.return_value
        
        # Check that appropriate fragment was used based on fields
        call_args = enhanced_client.base_client.execute_query.call_args
        query = call_args[1]["query"]
        assert "fragment ProductWithImages on Product" in query
    
    async def test_get_multiple_orders_with_intelligent_batching(self, enhanced_client):
        """Test getting multiple orders with intelligent batching"""
        # Setup responses
        enhanced_client.base_client.execute_query.return_value = {
            "q0": {"order": {"id": "1", "name": "#1001"}},
            "q1": {"order": {"id": "2", "name": "#1002"}},
            "q2": {"order": {"id": "3", "name": "#1003"}}
        }
        
        # Disable batch processor to force direct batching
        enhanced_client.batch_processor = None
        
        # Get multiple orders
        results = await enhanced_client.get_multiple_orders(
            order_ids=["1", "2", "3"],
            fragment_name="CoreOrderFields"
        )
        
        # Verify results
        assert len(results) == 3
        assert results[0]["id"] == "1"
        assert results[1]["id"] == "2"
        assert results[2]["id"] == "3"
        
        # Verify that combined query was used
        call_args = enhanced_client.base_client.execute_query.call_args
        query = call_args[1]["query"]
        
        # Query should contain fragment and multiple order queries
        assert "fragment CoreOrderFields on Order" in query
        assert "query BatchedQuery" in query
        assert "q0:" in query and "q1:" in query and "q2:" in query
    
    async def test_error_handling(self, enhanced_client):
        """Test error handling with different error types"""
        # GraphQL error
        enhanced_client.base_client.execute_query.side_effect = ShopifyGraphQLError(
            message="Test GraphQL error",
            errors=[{"message": "Test error", "extensions": {"cost": 50}}]
        )
        
        with pytest.raises(ShopifyGraphQLError):
            await enhanced_client.execute_query("query { test }")
            
        assert enhanced_client.metrics["errors"] == 1
        
        # Rate limit error
        enhanced_client.base_client.execute_query.side_effect = ShopifyRateLimitError(
            message="Rate limit exceeded",
            retry_after=30
        )
        
        with pytest.raises(ShopifyRateLimitError):
            await enhanced_client.execute_query("query { test }")
            
        assert enhanced_client.metrics["errors"] == 2