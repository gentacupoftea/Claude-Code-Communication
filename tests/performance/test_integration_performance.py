import pytest
import time
import concurrent.futures
import asyncio
import aiohttp
from unittest.mock import Mock, patch

from src.integration.inventory_orders_integration import InventoryOrdersIntegration
from src.integration.customer_product_integration import CustomerProductIntegration
from src.integration.analytics_integration import AnalyticsIntegration


class TestIntegrationPerformance:
    """Performance tests for data integration modules."""
    
    @pytest.fixture
    def mock_shopify_client(self):
        """Mock Shopify client for testing."""
        return Mock()
    
    @pytest.mark.performance
    async def test_inventory_orders_integration_load(self, mock_shopify_client):
        """Test inventory orders integration under load."""
        integration = InventoryOrdersIntegration(mock_shopify_client)
        
        # Configure mock responses
        mock_shopify_client.get_products.return_value = [
            {"id": i, "title": f"Product {i}", "variants": [{"inventory_quantity": 100}]}
            for i in range(1000)
        ]
        mock_shopify_client.get_orders.return_value = [
            {"id": i, "total_price": "100.00", "currency": "USD"}
            for i in range(5000)
        ]
        
        start_time = time.time()
        
        # Run concurrent requests
        async def run_integration():
            return await integration.get_integrated_data(
                filters={"status": "active"},
                options={"batch_size": 100}
            )
        
        tasks = [run_integration() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Performance assertions
        assert elapsed_time < 5.0, f"Integration took {elapsed_time}s, expected < 5s"
        assert all(result["status"] == "success" for result in results)
        
        # Calculate throughput
        total_records = sum(result["total_records"] for result in results)
        throughput = total_records / elapsed_time
        assert throughput > 1000, f"Throughput {throughput} records/s, expected > 1000"
    
    @pytest.mark.performance
    async def test_customer_product_integration_memory(self, mock_shopify_client):
        """Test memory usage during customer product integration."""
        import psutil
        import os
        
        integration = CustomerProductIntegration(mock_shopify_client)
        process = psutil.Process(os.getpid())
        
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Large dataset
        mock_shopify_client.get_customers.return_value = [
            {"id": i, "email": f"customer{i}@example.com"}
            for i in range(10000)
        ]
        mock_shopify_client.get_orders.return_value = [
            {"customer": {"id": i % 10000}, "line_items": [{"product_id": j} for j in range(5)]}
            for i in range(50000)
        ]
        
        # Process large dataset
        result = await integration.get_integrated_data(
            options={"stream": True, "batch_size": 1000}
        )
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory usage should not exceed reasonable limits
        assert memory_increase < 500, f"Memory increased by {memory_increase}MB, expected < 500MB"
        assert result["status"] == "success"
    
    @pytest.mark.performance
    def test_analytics_integration_concurrent_access(self, mock_shopify_client):
        """Test analytics integration with concurrent access."""
        integration = AnalyticsIntegration(mock_shopify_client)
        
        # Mock data
        mock_shopify_client.get_orders.return_value = [
            {
                "id": i,
                "created_at": "2025-01-01T00:00:00Z",
                "total_price": "100.00",
                "line_items": [{"product_id": i % 100, "quantity": 1}]
            }
            for i in range(1000)
        ]
        
        def run_analytics():
            return integration.get_analytics_report(
                report_type="daily_sales",
                date_range={"start": "2025-01-01", "end": "2025-01-07"}
            )
        
        start_time = time.time()
        
        # Run concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(run_analytics) for _ in range(100)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Performance assertions
        assert elapsed_time < 10.0, f"Concurrent access took {elapsed_time}s, expected < 10s"
        assert all(result["status"] == "success" for result in results)
        
        # Check consistency
        first_result = results[0]
        for result in results[1:]:
            assert result["data"] == first_result["data"], "Inconsistent results"
    
    @pytest.mark.performance
    async def test_integration_error_recovery(self, mock_shopify_client):
        """Test performance during error recovery scenarios."""
        integration = InventoryOrdersIntegration(mock_shopify_client)
        
        error_count = 0
        call_count = 0
        
        def mock_get_products():
            nonlocal call_count, error_count
            call_count += 1
            if call_count % 3 == 0 and error_count < 10:
                error_count += 1
                raise Exception("Simulated API error")
            return [{"id": i, "variants": [{"inventory_quantity": 100}]} for i in range(100)]
        
        mock_shopify_client.get_products.side_effect = mock_get_products
        mock_shopify_client.get_orders.return_value = [{"id": i} for i in range(500)]
        
        start_time = time.time()
        
        # Run with retries
        result = await integration.get_integrated_data(
            options={"retry_count": 3, "retry_delay": 0.1}
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Should handle errors efficiently
        assert elapsed_time < 5.0, f"Error recovery took {elapsed_time}s, expected < 5s"
        assert result["status"] == "success"
        assert result["error_count"] == error_count
    
    @pytest.mark.performance
    def test_batch_processing_efficiency(self, mock_shopify_client):
        """Test batch processing efficiency."""
        integration = CustomerProductIntegration(mock_shopify_client)
        
        # Test different batch sizes
        batch_sizes = [10, 50, 100, 500, 1000]
        performance_results = []
        
        for batch_size in batch_sizes:
            mock_shopify_client.get_customers.return_value = [
                {"id": i} for i in range(10000)
            ]
            
            start_time = time.time()
            
            result = integration.get_integrated_data(
                options={"batch_size": batch_size}
            )
            
            end_time = time.time()
            elapsed_time = end_time - start_time
            
            performance_results.append({
                "batch_size": batch_size,
                "elapsed_time": elapsed_time,
                "records_per_second": 10000 / elapsed_time
            })
        
        # Verify optimal batch size
        optimal_batch = max(performance_results, key=lambda x: x["records_per_second"])
        assert 100 <= optimal_batch["batch_size"] <= 500, "Optimal batch size out of expected range"
        
        # Performance should improve with reasonable batch sizes
        small_batch_perf = next(r for r in performance_results if r["batch_size"] == 10)
        large_batch_perf = next(r for r in performance_results if r["batch_size"] == 100)
        assert large_batch_perf["records_per_second"] > small_batch_perf["records_per_second"]
