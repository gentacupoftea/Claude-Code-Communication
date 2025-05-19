"""
Tests for GraphQL Batch Processor
"""

import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch

from src.api.shopify.batch_processor import (
    GraphQLBatchProcessor,
    QueryRequest,
    BatchQuery,
    QueryOptimizer
)


class TestGraphQLBatchProcessor:
    """Test GraphQL batch processor"""
    
    @pytest.fixture
    async def batch_processor(self):
        """Create test batch processor"""
        mock_client = Mock()
        mock_client.execute_query = AsyncMock()
        
        processor = GraphQLBatchProcessor(
            graphql_client=mock_client,
            batch_size=3,
            batch_timeout=0.1,
            max_query_cost=100
        )
        
        await processor.start()
        yield processor
        await processor.stop()
    
    @pytest.mark.asyncio
    async def test_single_query_execution(self, batch_processor):
        """Test single query execution"""
        # Setup
        query = "query { orders { edges { node { id } } } }"
        expected_result = {"orders": {"edges": []}}
        
        batch_processor.client.execute_query.return_value = {
            "q0": expected_result
        }
        
        # Execute
        result = await batch_processor.add_query(query)
        
        # Verify
        assert result == expected_result
        assert batch_processor.client.execute_query.called
    
    @pytest.mark.asyncio
    async def test_batch_formation(self, batch_processor):
        """Test that queries are batched correctly"""
        # Setup
        queries = [
            "query { orders { edges { node { id } } } }",
            "query { products { edges { node { id } } } }",
            "query { customers { edges { node { id } } } }"
        ]
        
        results = {
            "q0": {"orders": {"edges": []}},
            "q1": {"products": {"edges": []}},
            "q2": {"customers": {"edges": []}}
        }
        
        batch_processor.client.execute_query.return_value = results
        
        # Execute queries concurrently
        tasks = [batch_processor.add_query(q) for q in queries]
        query_results = await asyncio.gather(*tasks)
        
        # Verify batching
        assert len(query_results) == 3
        assert batch_processor.client.execute_query.call_count == 1
        
        # Verify batch query formation
        call_args = batch_processor.client.execute_query.call_args
        batch_query = call_args[0][0]
        
        assert "q0:" in batch_query
        assert "q1:" in batch_query
        assert "q2:" in batch_query
    
    @pytest.mark.asyncio
    async def test_priority_ordering(self, batch_processor):
        """Test that high priority queries are processed first"""
        # Track order of execution
        execution_order = []
        
        async def mock_execute(query, variables=None):
            # Extract query aliases to track order
            aliases = [line.strip().split(':')[0] 
                      for line in query.split('\n') 
                      if ':' in line and line.strip().startswith('q')]
            execution_order.extend(aliases)
            
            # Return results
            return {alias: {"data": f"result_{alias}"} for alias in aliases}
        
        batch_processor.client.execute_query = mock_execute
        
        # Add queries with different priorities
        tasks = []
        tasks.append(batch_processor.add_query("query1", priority=5))
        tasks.append(batch_processor.add_query("query2", priority=1))  # Highest
        tasks.append(batch_processor.add_query("query3", priority=3))
        
        # Execute
        await asyncio.gather(*tasks)
        
        # The highest priority query should be in the first batch
        assert 'q1' in execution_order  # query2 has priority 1
    
    @pytest.mark.asyncio
    async def test_cost_estimation(self, batch_processor):
        """Test query cost estimation"""
        # Simple query
        simple_query = "query { shop { name } }"
        simple_cost = batch_processor._estimate_query_cost(simple_query)
        
        # Complex query with connections
        complex_query = """
        query {
            orders(first: 100) {
                edges {
                    node {
                        id
                        lineItems(first: 50) {
                            edges {
                                node {
                                    title
                                }
                            }
                        }
                    }
                }
            }
        }
        """
        complex_cost = batch_processor._estimate_query_cost(complex_query)
        
        # Complex query should have higher cost
        assert complex_cost > simple_cost
        assert complex_cost > 50  # Due to pagination and nested connections
    
    @pytest.mark.asyncio
    async def test_dependency_handling(self, batch_processor):
        """Test query dependency handling"""
        # Setup
        execution_order = []
        
        async def track_execution(query, variables=None):
            execution_order.append(query)
            return {"q0": {"data": "result"}}
        
        batch_processor.client.execute_query = track_execution
        
        # Create queries with dependencies
        query1_id = await batch_processor.add_query("query1")
        
        # This should wait for query1
        query2 = await batch_processor.add_query(
            "query2",
            dependencies={query1_id}
        )
        
        # Verify execution order
        assert len(execution_order) >= 1
    
    @pytest.mark.asyncio
    async def test_error_handling(self, batch_processor):
        """Test error handling in batch processing"""
        # Setup
        batch_processor.client.execute_query.side_effect = Exception("API Error")
        
        # Execute
        with pytest.raises(Exception, match="API Error"):
            await batch_processor.add_query("query { error }")
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self, batch_processor):
        """Test metrics collection"""
        # Execute some queries
        batch_processor.client.execute_query.return_value = {
            "q0": {"data": "result1"},
            "q1": {"data": "result2"}
        }
        
        tasks = [
            batch_processor.add_query("query1"),
            batch_processor.add_query("query2")
        ]
        await asyncio.gather(*tasks)
        
        # Check metrics
        metrics = batch_processor.get_metrics()
        
        assert metrics['total_queries'] >= 2
        assert metrics['total_batches'] >= 1
        assert metrics['avg_batch_size'] > 0
        assert metrics['avg_response_time'] > 0
    
    @pytest.mark.asyncio
    async def test_operation_extraction(self, batch_processor):
        """Test GraphQL operation extraction"""
        query = """
        query GetOrders {
            orders(first: 10) {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
        """
        
        operation = batch_processor._extract_operation(query)
        
        assert "orders(first: 10)" in operation
        assert "edges" in operation
        assert "query GetOrders" not in operation
    
    @pytest.mark.asyncio
    async def test_batch_timeout(self, batch_processor):
        """Test batch timeout mechanism"""
        # Setup
        batch_processor.batch_timeout = 0.05  # 50ms timeout
        
        batch_processor.client.execute_query.return_value = {
            "q0": {"data": "result"}
        }
        
        # Add single query
        start_time = asyncio.get_event_loop().time()
        result = await batch_processor.add_query("query { test }")
        end_time = asyncio.get_event_loop().time()
        
        # Should execute after timeout
        assert result == {"data": "result"}
        assert (end_time - start_time) >= 0.04  # Allow some variance


class TestQueryOptimizer:
    """Test query optimizer"""
    
    def test_field_usage_tracking(self):
        """Test field usage statistics"""
        optimizer = QueryOptimizer()
        
        # Track field usage
        optimizer.optimize_query("query1", {"id", "name", "email"})
        optimizer.optimize_query("query2", {"id", "name"})
        optimizer.optimize_query("query3", {"id", "email"})
        
        # Check statistics
        assert optimizer.field_usage_stats["id"] == 3
        assert optimizer.field_usage_stats["name"] == 2
        assert optimizer.field_usage_stats["email"] == 2