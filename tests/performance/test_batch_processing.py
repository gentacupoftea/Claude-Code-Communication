import pytest
import time
import memory_profiler
import concurrent.futures
import asyncio
from unittest.mock import Mock, patch
import pandas as pd
import numpy as np

from src.integration.batch_processor import BatchProcessor
from src.integration.inventory_orders_integration import InventoryOrdersIntegration
from src.integration.customer_product_integration import CustomerProductIntegration


class TestBatchProcessing:
    """Test batch processing performance."""
    
    @pytest.fixture
    def batch_processor(self):
        """Create batch processor instance."""
        return BatchProcessor(batch_size=100, max_workers=4)
    
    @pytest.fixture
    def large_dataset(self):
        """Generate large dataset for testing."""
        return [
            {
                "id": i,
                "name": f"Item {i}",
                "price": round(np.random.uniform(10, 1000), 2),
                "quantity": np.random.randint(1, 100),
                "category": f"Category {i % 10}",
                "tags": [f"tag{j}" for j in range(np.random.randint(1, 5))]
            }
            for i in range(100000)
        ]
    
    @pytest.mark.performance
    def test_batch_processing_throughput(self, batch_processor, large_dataset):
        """Test batch processing throughput."""
        def process_item(item):
            # Simulate processing
            time.sleep(0.001)
            return {
                "id": item["id"],
                "processed": True,
                "total": item["price"] * item["quantity"]
            }
        
        start_time = time.time()
        
        # Process in batches
        results = batch_processor.process_batches(
            data=large_dataset,
            process_fn=process_item,
            batch_size=1000
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Calculate throughput
        throughput = len(large_dataset) / elapsed_time
        
        # Performance assertions
        assert throughput > 5000, f"Throughput {throughput} items/s, expected > 5000"
        assert len(results) == len(large_dataset), "Not all items processed"
        assert all(r["processed"] for r in results), "Some items not processed correctly"
    
    @pytest.mark.performance
    async def test_async_batch_processing(self, batch_processor, large_dataset):
        """Test asynchronous batch processing."""
        async def async_process_item(item):
            # Simulate async processing
            await asyncio.sleep(0.001)
            return {
                "id": item["id"],
                "processed": True,
                "async": True
            }
        
        start_time = time.time()
        
        # Process asynchronously
        results = await batch_processor.async_process_batches(
            data=large_dataset,
            process_fn=async_process_item,
            batch_size=500,
            max_concurrent=20
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Async should be faster
        throughput = len(large_dataset) / elapsed_time
        assert throughput > 10000, f"Async throughput {throughput} items/s, expected > 10000"
        assert all(r["async"] for r in results), "Not all items processed async"
    
    @pytest.mark.performance
    @memory_profiler.profile
    def test_memory_efficient_batch_processing(self, batch_processor):
        """Test memory efficiency during batch processing."""
        # Generator for memory efficiency
        def data_generator():
            for i in range(1000000):
                yield {
                    "id": i,
                    "data": f"Large data string {i}" * 100  # Simulate large objects
                }
        
        def process_item(item):
            # Process and reduce data size
            return {
                "id": item["id"],
                "hash": hash(item["data"])
            }
        
        # Process using generator to avoid loading all data
        results = batch_processor.stream_process(
            data_generator=data_generator(),
            process_fn=process_item,
            batch_size=1000
        )
        
        # Results should be a generator, not a list
        processed_count = 0
        for result in results:
            processed_count += 1
            if processed_count >= 10000:  # Process subset for test
                break
        
        assert processed_count == 10000, "Stream processing failed"
    
    @pytest.mark.performance
    def test_optimal_batch_size(self, batch_processor):
        """Test to find optimal batch size."""
        dataset_size = 50000
        dataset = [{"id": i, "value": i * 2} for i in range(dataset_size)]
        
        def process_item(item):
            # Simulate computation
            return item["value"] ** 2
        
        batch_sizes = [10, 50, 100, 250, 500, 1000, 2000, 5000]
        performance_results = []
        
        for batch_size in batch_sizes:
            start_time = time.time()
            
            results = batch_processor.process_batches(
                data=dataset,
                process_fn=process_item,
                batch_size=batch_size
            )
            
            elapsed_time = time.time() - start_time
            
            performance_results.append({
                "batch_size": batch_size,
                "elapsed_time": elapsed_time,
                "throughput": dataset_size / elapsed_time
            })
        
        # Find optimal batch size
        optimal = max(performance_results, key=lambda x: x["throughput"])
        assert 250 <= optimal["batch_size"] <= 1000, f"Optimal batch size {optimal['batch_size']} out of expected range"
    
    @pytest.mark.performance
    def test_error_handling_performance(self, batch_processor):
        """Test performance with error handling."""
        dataset = [{"id": i, "value": i} for i in range(10000)]
        error_rate = 0.1  # 10% error rate
        
        def process_with_errors(item):
            if np.random.random() < error_rate:
                raise ValueError(f"Simulated error for item {item['id']}")
            return item["value"] * 2
        
        start_time = time.time()
        
        results, errors = batch_processor.process_with_error_handling(
            data=dataset,
            process_fn=process_with_errors,
            batch_size=100,
            retry_count=3
        )
        
        elapsed_time = time.time() - start_time
        
        # Should handle errors efficiently
        success_rate = len(results) / len(dataset)
        assert success_rate > 0.85, f"Success rate {success_rate} too low"
        assert elapsed_time < 5.0, f"Error handling took {elapsed_time}s, expected < 5s"
    
    @pytest.mark.performance
    def test_parallel_batch_processing(self, batch_processor):
        """Test parallel batch processing performance."""
        # Multiple datasets to process in parallel
        datasets = [
            [{"id": f"{ds}_{i}", "value": i} for i in range(20000)]
            for ds in range(5)
        ]
        
        def process_dataset(dataset):
            return batch_processor.process_batches(
                data=dataset,
                process_fn=lambda x: x["value"] ** 2,
                batch_size=500
            )
        
        start_time = time.time()
        
        # Process datasets in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(process_dataset, ds) for ds in datasets]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Parallel processing should be efficient
        total_items = sum(len(ds) for ds in datasets)
        throughput = total_items / elapsed_time
        assert throughput > 20000, f"Parallel throughput {throughput} items/s, expected > 20000"
    
    @pytest.mark.performance
    def test_batch_aggregation_performance(self, batch_processor):
        """Test batch aggregation performance."""
        # Generate time series data
        data = [
            {
                "timestamp": pd.Timestamp("2025-01-01") + pd.Timedelta(minutes=i),
                "value": np.sin(i / 100) * 100 + np.random.normal(0, 10),
                "category": f"cat_{i % 10}"
            }
            for i in range(100000)
        ]
        
        def aggregate_batch(batch):
            df = pd.DataFrame(batch)
            return {
                "count": len(batch),
                "mean_value": df["value"].mean(),
                "std_value": df["value"].std(),
                "categories": df["category"].nunique()
            }
        
        start_time = time.time()
        
        # Process with aggregation
        aggregated_results = batch_processor.process_with_aggregation(
            data=data,
            aggregate_fn=aggregate_batch,
            batch_size=5000
        )
        
        elapsed_time = time.time() - start_time
        
        # Aggregation should be efficient
        assert elapsed_time < 2.0, f"Aggregation took {elapsed_time}s, expected < 2s"
        assert len(aggregated_results) == len(data) // 5000 + (1 if len(data) % 5000 else 0)
    
    @pytest.mark.performance
    def test_batch_transformation_pipeline(self, batch_processor):
        """Test batch transformation pipeline performance."""
        dataset = [{"id": i, "raw_data": f"data_{i}" * 10} for i in range(50000)]
        
        # Define transformation pipeline
        def transform_1(item):
            return {**item, "step1": len(item["raw_data"])}
        
        def transform_2(item):
            return {**item, "step2": item["step1"] * 2}
        
        def transform_3(item):
            return {"id": item["id"], "final": item["step2"] / 10}
        
        pipeline = [transform_1, transform_2, transform_3]
        
        start_time = time.time()
        
        # Process through pipeline
        results = batch_processor.process_pipeline(
            data=dataset,
            pipeline=pipeline,
            batch_size=1000
        )
        
        elapsed_time = time.time() - start_time
        throughput = len(dataset) / elapsed_time
        
        # Pipeline should be efficient
        assert throughput > 10000, f"Pipeline throughput {throughput} items/s, expected > 10000"
        assert all("final" in r for r in results), "Pipeline transformation incomplete"
