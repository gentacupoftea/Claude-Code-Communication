import pytest
import time
import statistics
import aiohttp
import asyncio
from unittest.mock import Mock, patch
import numpy as np

from src.integration.inventory_orders_integration import InventoryOrdersIntegration
from src.integration.customer_product_integration import CustomerProductIntegration
from src.integration.analytics_integration import AnalyticsIntegration


class TestAPIResponseTime:
    """Test API response time performance."""
    
    @pytest.fixture
    def mock_shopify_client(self):
        """Mock Shopify client with response time simulation."""
        client = Mock()
        
        async def simulate_api_call(delay=0.1):
            await asyncio.sleep(delay)
            return [{"id": i} for i in range(100)]
        
        client.get_products.side_effect = lambda: simulate_api_call(0.05)
        client.get_orders.side_effect = lambda: simulate_api_call(0.08)
        client.get_customers.side_effect = lambda: simulate_api_call(0.06)
        
        return client
    
    @pytest.mark.performance
    async def test_individual_api_response_times(self, mock_shopify_client):
        """Test individual API endpoint response times."""
        response_times = {
            "products": [],
            "orders": [],
            "customers": []
        }
        
        # Measure response times
        for _ in range(50):
            # Products
            start = time.time()
            await mock_shopify_client.get_products()
            response_times["products"].append(time.time() - start)
            
            # Orders
            start = time.time()
            await mock_shopify_client.get_orders()
            response_times["orders"].append(time.time() - start)
            
            # Customers
            start = time.time()
            await mock_shopify_client.get_customers()
            response_times["customers"].append(time.time() - start)
        
        # Calculate statistics
        for endpoint, times in response_times.items():
            avg_time = statistics.mean(times)
            p95_time = np.percentile(times, 95)
            p99_time = np.percentile(times, 99)
            
            # Performance assertions
            assert avg_time < 0.2, f"{endpoint} avg response time {avg_time}s > 0.2s"
            assert p95_time < 0.3, f"{endpoint} P95 response time {p95_time}s > 0.3s"
            assert p99_time < 0.5, f"{endpoint} P99 response time {p99_time}s > 0.5s"
    
    @pytest.mark.performance
    async def test_integration_response_time(self, mock_shopify_client):
        """Test integrated module response times."""
        integrations = {
            "inventory_orders": InventoryOrdersIntegration(mock_shopify_client),
            "customer_product": CustomerProductIntegration(mock_shopify_client),
            "analytics": AnalyticsIntegration(mock_shopify_client)
        }
        
        response_times = {name: [] for name in integrations}
        
        # Measure integration response times
        for _ in range(20):
            for name, integration in integrations.items():
                start = time.time()
                
                if name == "analytics":
                    result = await integration.get_analytics_report(
                        report_type="daily_sales",
                        date_range={"start": "2025-01-01", "end": "2025-01-07"}
                    )
                else:
                    result = await integration.get_integrated_data()
                
                response_times[name].append(time.time() - start)
        
        # Analyze results
        for name, times in response_times.items():
            avg_time = statistics.mean(times)
            max_time = max(times)
            min_time = min(times)
            std_dev = statistics.stdev(times)
            
            # Performance requirements
            assert avg_time < 1.0, f"{name} avg response time {avg_time}s > 1.0s"
            assert max_time < 2.0, f"{name} max response time {max_time}s > 2.0s"
            assert std_dev < 0.5, f"{name} response time variation too high: {std_dev}s"
    
    @pytest.mark.performance
    async def test_parallel_request_handling(self, mock_shopify_client):
        """Test response time with parallel requests."""
        integration = InventoryOrdersIntegration(mock_shopify_client)
        
        parallel_counts = [1, 5, 10, 20, 50]
        results = []
        
        for count in parallel_counts:
            start_time = time.time()
            
            # Create parallel requests
            tasks = [
                integration.get_integrated_data()
                for _ in range(count)
            ]
            
            responses = await asyncio.gather(*tasks)
            end_time = time.time()
            
            total_time = end_time - start_time
            avg_response_time = total_time / count
            
            results.append({
                "parallel_count": count,
                "total_time": total_time,
                "avg_response_time": avg_response_time
            })
        
        # Verify scaling characteristics
        single_request_time = results[0]["avg_response_time"]
        
        for result in results[1:]:
            # Response time should not degrade significantly with parallelism
            degradation = result["avg_response_time"] / single_request_time
            assert degradation < 2.0, f"Response time degraded by {degradation}x with {result['parallel_count']} parallel requests"
    
    @pytest.mark.performance
    async def test_caching_performance(self, mock_shopify_client):
        """Test response time improvements with caching."""
        integration = CustomerProductIntegration(mock_shopify_client)
        
        # Enable caching
        integration.enable_cache(ttl=60)
        
        # First request (cache miss)
        start_time = time.time()
        first_result = await integration.get_integrated_data(
            filters={"customer_id": 12345}
        )
        first_request_time = time.time() - start_time
        
        # Second request (cache hit)
        start_time = time.time()
        second_result = await integration.get_integrated_data(
            filters={"customer_id": 12345}
        )
        second_request_time = time.time() - start_time
        
        # Cache hit should be significantly faster
        speedup = first_request_time / second_request_time
        assert speedup > 10, f"Cache speedup only {speedup}x, expected > 10x"
        assert second_request_time < 0.01, f"Cached response took {second_request_time}s, expected < 0.01s"
        
        # Verify data consistency
        assert first_result == second_result, "Cached data doesn't match original"
    
    @pytest.mark.performance
    async def test_timeout_handling(self, mock_shopify_client):
        """Test response time with timeout scenarios."""
        integration = AnalyticsIntegration(mock_shopify_client)
        
        # Configure slow API responses
        async def slow_response():
            await asyncio.sleep(2.0)
            return [{"id": 1}]
        
        mock_shopify_client.get_orders.side_effect = slow_response
        
        # Test with timeout
        start_time = time.time()
        
        with pytest.raises(asyncio.TimeoutError):
            await integration.get_analytics_report(
                report_type="daily_sales",
                date_range={"start": "2025-01-01", "end": "2025-01-07"},
                timeout=1.0
            )
        
        elapsed_time = time.time() - start_time
        
        # Should timeout within specified time
        assert 0.9 < elapsed_time < 1.2, f"Timeout took {elapsed_time}s, expected ~1.0s"
    
    @pytest.mark.performance
    async def test_response_time_percentiles(self, mock_shopify_client):
        """Test response time percentiles across different scenarios."""
        integration = InventoryOrdersIntegration(mock_shopify_client)
        
        # Simulate variable response times
        response_delays = np.random.exponential(0.1, 1000)
        response_index = 0
        
        async def variable_delay_response():
            nonlocal response_index
            delay = response_delays[response_index % len(response_delays)]
            response_index += 1
            await asyncio.sleep(delay)
            return [{"id": i} for i in range(50)]
        
        mock_shopify_client.get_products.side_effect = variable_delay_response
        mock_shopify_client.get_orders.side_effect = variable_delay_response
        
        # Collect response times
        response_times = []
        
        for _ in range(200):
            start_time = time.time()
            await integration.get_integrated_data()
            response_times.append(time.time() - start_time)
        
        # Calculate percentiles
        p50 = np.percentile(response_times, 50)
        p90 = np.percentile(response_times, 90)
        p95 = np.percentile(response_times, 95)
        p99 = np.percentile(response_times, 99)
        
        # Performance SLOs
        assert p50 < 0.5, f"P50 response time {p50}s > 0.5s"
        assert p90 < 1.0, f"P90 response time {p90}s > 1.0s"
        assert p95 < 1.5, f"P95 response time {p95}s > 1.5s"
        assert p99 < 2.0, f"P99 response time {p99}s > 2.0s"
