"""
Tests for Adaptive Rate Limiter
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, patch

from src.api.shopify.rate_limiter import (
    AdaptiveRateLimiter,
    CostCalculator,
    QueryCostEstimate,
    RateLimitState,
    QueryExecution
)


class TestCostCalculator:
    """Test query cost calculation"""
    
    def test_simple_query_cost(self):
        """Test cost calculation for simple queries"""
        calculator = CostCalculator()
        
        # Very simple query
        simple_query = "query { shop { name } }"
        estimate = calculator.estimate_query_cost(simple_query)
        
        assert estimate.base_cost == 1
        assert estimate.field_cost == 1  # name field
        assert estimate.connection_cost == 0
        assert estimate.total_cost == 2
    
    def test_complex_query_cost(self):
        """Test cost calculation for complex queries"""
        calculator = CostCalculator()
        
        complex_query = """
        query {
            orders(first: 100) {
                edges {
                    node {
                        id
                        totalPrice
                        lineItems(first: 50) {
                            edges {
                                node {
                                    title
                                    quantity
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                }
            }
        }
        """
        
        estimate = calculator.estimate_query_cost(complex_query)
        
        assert estimate.base_cost == 1
        assert estimate.field_cost > 0  # Multiple fields
        assert estimate.connection_cost > 0  # Multiple connections
        assert estimate.total_cost > 50  # Should be significant due to pagination
    
    def test_pagination_multiplier(self):
        """Test pagination cost multiplier"""
        calculator = CostCalculator()
        
        # Query with small pagination
        small_query = "query { orders(first: 10) { edges { node { id } } } }"
        small_estimate = calculator.estimate_query_cost(small_query)
        
        # Query with large pagination
        large_query = "query { orders(first: 200) { edges { node { id } } } }"
        large_estimate = calculator.estimate_query_cost(large_query)
        
        # Large pagination should have higher cost
        assert large_estimate.total_cost > small_estimate.total_cost
        assert large_estimate.connection_cost > small_estimate.connection_cost
    
    def test_field_recognition(self):
        """Test field cost recognition"""
        calculator = CostCalculator()
        
        # Query with various field types
        query = """
        query {
            order {
                id
                name
                totalPrice
                subtotalPrice
                metafields
                tags
            }
        }
        """
        
        estimate = calculator.estimate_query_cost(query)
        
        # Should recognize different field costs
        assert estimate.field_cost >= 11  # Sum of individual field costs
        assert estimate.confidence > 0.5
    
    def test_confidence_calculation(self):
        """Test confidence score calculation"""
        calculator = CostCalculator()
        
        # Empty query
        empty_query = "query { }"
        empty_estimate = calculator.estimate_query_cost(empty_query)
        assert empty_estimate.confidence == 0.5
        
        # Complex query
        complex_query = """
        query {
            orders {
                edges {
                    node {
                        id
                        name
                        totalPrice
                    }
                }
            }
        }
        """
        complex_estimate = calculator.estimate_query_cost(complex_query)
        assert complex_estimate.confidence > 0.6


class TestRateLimitState:
    """Test rate limit state calculations"""
    
    def test_usage_percentage(self):
        """Test usage percentage calculation"""
        state = RateLimitState(
            cost_available=300,
            cost_limit=1000
        )
        
        assert state.usage_percentage == 0.7  # 70% used
    
    def test_restore_time_calculation(self):
        """Test restore time calculation"""
        state = RateLimitState(
            cost_available=300,
            cost_limit=1000,
            restore_rate=50
        )
        
        # Need to restore 700 points at 50/sec
        assert state.time_to_full_restore == 14.0
        
        # Test with zero restore rate
        state.restore_rate = 0
        assert state.time_to_full_restore == 0


class TestAdaptiveRateLimiter:
    """Test adaptive rate limiter"""
    
    @pytest.fixture
    async def rate_limiter(self):
        """Create test rate limiter"""
        limiter = AdaptiveRateLimiter(
            initial_limit=100,
            restore_rate=10,
            bucket_size=100
        )
        await limiter.start()
        yield limiter
        await limiter.stop()
    
    @pytest.mark.asyncio
    async def test_basic_acquire_release(self, rate_limiter):
        """Test basic acquire/release flow"""
        query = "query { shop { name } }"
        
        # Acquire
        execution = await rate_limiter.acquire(query)
        assert execution.query_id is not None
        assert execution.estimated_cost > 0
        
        # Check state
        assert rate_limiter.state.queries_executing == 1
        assert rate_limiter.state.cost_available < 100
        
        # Release
        rate_limiter.release(execution, actual_cost=5)
        assert rate_limiter.state.queries_executing == 0
    
    @pytest.mark.asyncio
    async def test_priority_queuing(self, rate_limiter):
        """Test priority-based queuing"""
        # Fill up rate limit
        rate_limiter.state.cost_available = 10
        
        executions = []
        
        # Add queries with different priorities
        tasks = []
        tasks.append(rate_limiter.acquire("query1", priority=5))
        tasks.append(rate_limiter.acquire("query2", priority=1))  # Highest
        tasks.append(rate_limiter.acquire("query3", priority=3))
        
        # Start tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # At least the highest priority should complete
        completed = [r for r in results if not isinstance(r, Exception)]
        assert len(completed) > 0
    
    @pytest.mark.asyncio
    async def test_cost_restoration(self, rate_limiter):
        """Test cost restoration over time"""
        # Use up some cost
        rate_limiter.state.cost_available = 50
        rate_limiter.state.cost_limit = 100
        initial_cost = rate_limiter.state.cost_available
        
        # Wait for restoration
        await asyncio.sleep(0.2)
        
        # Cost should have been restored
        assert rate_limiter.state.cost_available > initial_cost
    
    @pytest.mark.asyncio
    async def test_wait_time_calculation(self, rate_limiter):
        """Test wait time calculation"""
        # Test basic wait time
        wait_time = rate_limiter._calculate_wait_time(50)
        assert wait_time > 0
        
        # Test with high usage (should trigger throttling)
        rate_limiter.state.cost_available = 10
        rate_limiter.state.cost_limit = 100
        
        throttled_wait = rate_limiter._calculate_wait_time(50)
        assert throttled_wait > wait_time  # Should be longer due to throttling
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self, rate_limiter):
        """Test timeout handling"""
        # Fill up rate limit
        rate_limiter.state.cost_available = 0
        
        # Try to acquire with short timeout
        with pytest.raises(asyncio.TimeoutError):
            await rate_limiter.acquire(
                "query { test }",
                timeout=0.05
            )
    
    @pytest.mark.asyncio
    async def test_concurrent_queries(self, rate_limiter):
        """Test concurrent query handling"""
        # Set semaphore limit
        rate_limiter.semaphore = asyncio.Semaphore(2)
        
        # Create multiple queries
        queries = [f"query{i}" for i in range(5)]
        
        async def execute_query(query):
            execution = await rate_limiter.acquire(query)
            await asyncio.sleep(0.1)  # Simulate execution
            rate_limiter.release(execution)
            return execution
        
        # Execute concurrently
        tasks = [execute_query(q) for q in queries]
        results = await asyncio.gather(*tasks)
        
        # All should complete
        assert len(results) == 5
        assert all(r.query_id for r in results)
    
    @pytest.mark.asyncio
    async def test_adaptive_backoff(self, rate_limiter):
        """Test adaptive backoff adjustment"""
        initial_backoff = rate_limiter.backoff_factor
        
        # Simulate accurate estimations
        for i in range(5):
            execution = QueryExecution(
                query_id=f"q{i}",
                estimated_cost=10,
                actual_cost=10  # Perfect estimation
            )
            rate_limiter.release(execution)
        
        rate_limiter._adjust_parameters()
        
        # Backoff should decrease with accurate estimates
        assert rate_limiter.backoff_factor <= initial_backoff
        
        # Simulate inaccurate estimations
        for i in range(5):
            execution = QueryExecution(
                query_id=f"q{i}",
                estimated_cost=10,
                actual_cost=50  # Large error
            )
            rate_limiter.release(execution)
        
        rate_limiter._adjust_parameters()
        
        # Backoff should increase with inaccurate estimates
        assert rate_limiter.backoff_factor > initial_backoff
    
    @pytest.mark.asyncio
    async def test_header_update(self, rate_limiter):
        """Test rate limit update from headers"""
        headers = {
            'X-Shopify-API-Call-Limit': '40/100'
        }
        
        rate_limiter.update_limits(headers)
        
        assert rate_limiter.state.cost_available == 60  # 100 - 40
        assert rate_limiter.state.cost_limit == 100
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self, rate_limiter):
        """Test metrics collection"""
        # Execute some queries
        executions = []
        
        for i in range(3):
            execution = await rate_limiter.acquire(f"query{i}")
            execution.success = True
            rate_limiter.release(execution, actual_cost=5)
            executions.append(execution)
        
        # Check metrics
        metrics = rate_limiter.get_metrics()
        
        assert metrics['total_executions'] == 3
        assert metrics['successful'] == 3
        assert metrics['failed'] == 0
        assert metrics['success_rate'] == 1.0
        assert metrics['avg_cost'] == 5
    
    @pytest.mark.asyncio
    async def test_state_reporting(self, rate_limiter):
        """Test state reporting"""
        # Set up some state
        rate_limiter.state.cost_available = 75
        rate_limiter.state.cost_limit = 100
        rate_limiter.state.queries_queued = 2
        rate_limiter.state.queries_executing = 1
        
        state = rate_limiter.get_state()
        
        assert state['cost_available'] == 75
        assert state['usage_percentage'] == 0.25
        assert state['queries_queued'] == 2
        assert state['queries_executing'] == 1
        assert 'time_to_full_restore' in state
        assert 'avg_wait_time' in state
    
    @pytest.mark.asyncio
    async def test_error_handling(self, rate_limiter):
        """Test error handling during execution"""
        query = "query { error }"
        
        # Acquire
        execution = await rate_limiter.acquire(query)
        
        # Simulate error
        try:
            raise Exception("Query failed")
        except Exception as e:
            execution.success = False
            execution.error = str(e)
            rate_limiter.release(execution)
        
        # Check execution record
        assert not execution.success
        assert execution.error == "Query failed"
        
        # Check metrics
        metrics = rate_limiter.get_metrics()
        assert metrics['failed'] == 1