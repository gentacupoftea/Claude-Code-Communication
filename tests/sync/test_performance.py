"""
Performance tests for Shopify Sync Engine.

Run with:
    pytest tests/sync/test_performance.py -v
"""

import pytest
import time
import json
import random
from unittest.mock import Mock, patch
import psutil
import os
import tempfile
from datetime import datetime, timedelta

from src.sync.shopify_sync import ShopifySyncEngine
from src.sync.sync_engine.models import SyncStatus, SyncType


# Skip these tests in CI
pytestmark = pytest.mark.skipif(
    os.environ.get("CI") == "true",
    reason="Performance tests are skipped in CI environment"
)


def generate_large_product_dataset(count=1000):
    """Generate a large dataset of mock products."""
    products = []
    
    for i in range(count):
        product_id = f"prod_{i}"
        products.append({
            "id": product_id,
            "title": f"Test Product {i}",
            "description": f"This is a test product {i} with a detailed description",
            "vendor": "Test Vendor",
            "product_type": "Test Type",
            "price": str(random.uniform(10, 1000)),
            "inventory_quantity": random.randint(0, 1000),
            "variants": [
                {
                    "id": f"var_{i}_1",
                    "title": "Small",
                    "price": str(random.uniform(10, 1000)),
                    "inventory_quantity": random.randint(0, 100)
                },
                {
                    "id": f"var_{i}_2",
                    "title": "Medium",
                    "price": str(random.uniform(10, 1000)),
                    "inventory_quantity": random.randint(0, 100)
                },
                {
                    "id": f"var_{i}_3",
                    "title": "Large",
                    "price": str(random.uniform(10, 1000)),
                    "inventory_quantity": random.randint(0, 100)
                }
            ],
            "tags": f"tag1, tag2, tag{i}"
        })
    
    return products


class MockLargePlatformAPI:
    """Mock external platform API that simulates processing delays."""
    
    def __init__(self, platform_name="large_platform", processing_delay=0.001):
        self.platform_name = platform_name
        self.processing_delay = processing_delay
        self.products = {}
        self.inventory = {}
        self.orders = []
        self.customers = {}
    
    async def initialize(self):
        """Initialize the API client."""
        return True
    
    def sync_products(self, shopify_products):
        """Sync products with simulated processing delay."""
        # Simulate processing delay proportional to data size
        time.sleep(self.processing_delay * len(shopify_products))
        
        for product in shopify_products:
            self.products[product['id']] = product
        
        return {
            "processed": len(shopify_products),
            "timestamp": datetime.now().isoformat()
        }
    
    def sync_inventory(self, shopify_inventory):
        """Sync inventory with simulated processing delay."""
        time.sleep(self.processing_delay * len(shopify_inventory))
        
        for inventory in shopify_inventory:
            self.inventory[inventory['inventory_item_id']] = inventory
        
        return {
            "processed": len(shopify_inventory),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_orders(self):
        """Get orders with simulated processing delay."""
        time.sleep(self.processing_delay * len(self.orders))
        return self.orders
    
    def sync_customers(self, shopify_customers):
        """Sync customers with simulated processing delay."""
        time.sleep(self.processing_delay * len(shopify_customers))
        
        for customer in shopify_customers:
            self.customers[customer['id']] = customer
        
        return {
            "processed": len(shopify_customers),
            "timestamp": datetime.now().isoformat()
        }


class TestSyncEnginePerformance:
    """Performance tests for Shopify Sync Engine."""
    
    @pytest.mark.parametrize("product_count", [10, 100, 1000])
    def test_product_sync_performance(self, product_count):
        """Test product sync performance with different data sizes."""
        # Generate mock data
        products = generate_large_product_dataset(product_count)
        
        # Create mock Shopify API
        mock_shopify_api = Mock()
        mock_shopify_api.get_products.return_value = products
        
        # Create mock external API
        external_api = MockLargePlatformAPI()
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("large_platform", external_api)
        
        # Measure memory before sync
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024  # MB
        
        # Measure sync time
        start_time = time.time()
        result = engine.sync_products_only()
        end_time = time.time()
        
        # Measure memory after sync
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        
        # Calculate metrics
        duration = end_time - start_time
        memory_delta = memory_after - memory_before
        
        # Log performance results
        performance = {
            "product_count": product_count,
            "duration_seconds": duration,
            "products_per_second": product_count / duration,
            "memory_before_mb": memory_before,
            "memory_after_mb": memory_after,
            "memory_delta_mb": memory_delta,
            "sync_result": {
                "status": result["status"],
                "synced_count": result["synced_count"],
                "failed_count": result["failed_count"]
            }
        }
        
        # Write to performance log
        self._log_performance_result("product_sync", performance)
        
        # Assertions
        assert result["status"] == "success"
        assert result["synced_count"] == product_count
        assert duration > 0
        
        # Print result for debugging
        print(f"\nProduct sync performance ({product_count} products):")
        print(f"  Duration: {duration:.4f} seconds")
        print(f"  Performance: {product_count / duration:.2f} products/second")
        print(f"  Memory delta: {memory_delta:.2f} MB")
    
    def test_multi_platform_sync_performance(self):
        """Test sync performance with multiple platforms."""
        # Generate mock data
        products = generate_large_product_dataset(100)
        
        # Create mock Shopify API
        mock_shopify_api = Mock()
        mock_shopify_api.get_products.return_value = products
        mock_shopify_api.get_inventory_levels.return_value = []
        mock_shopify_api.get_customers.return_value = []
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Create multiple external platforms with different delays
        platforms = {
            "fast_platform": MockLargePlatformAPI("fast_platform", 0.0005),
            "medium_platform": MockLargePlatformAPI("medium_platform", 0.001),
            "slow_platform": MockLargePlatformAPI("slow_platform", 0.002)
        }
        
        # Register all platforms
        for name, api in platforms.items():
            engine.register_external_api(name, api)
        
        # Measure sync time
        start_time = time.time()
        result = engine.sync_all()
        end_time = time.time()
        
        # Calculate duration
        duration = end_time - start_time
        
        # Log performance results
        performance = {
            "platform_count": len(platforms),
            "product_count": len(products),
            "duration_seconds": duration,
            "sync_result": {
                "status": result["status"],
                "synced_count": result["synced_count"],
                "failed_count": result["failed_count"]
            }
        }
        
        # Add platform-specific results
        for platform_name, api in platforms.items():
            performance[f"{platform_name}_products"] = len(api.products)
        
        # Write to performance log
        self._log_performance_result("multi_platform_sync", performance)
        
        # Assertions
        assert result["status"] == "success"
        assert result["synced_count"] > 0
        
        # Print result for debugging
        print(f"\nMulti-platform sync performance ({len(platforms)} platforms):")
        print(f"  Duration: {duration:.4f} seconds")
        print(f"  Products synced: {result['synced_count']}")
    
    def test_scheduler_performance(self):
        """Test scheduler performance over time."""
        # Create mock Shopify API with small dataset for quicker testing
        mock_shopify_api = Mock()
        mock_shopify_api.get_products.return_value = generate_large_product_dataset(10)
        mock_shopify_api.get_inventory_levels.return_value = []
        mock_shopify_api.get_customers.return_value = []
        
        # Create external API
        external_api = MockLargePlatformAPI()
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("test_platform", external_api)
        
        # Start the scheduler with a short interval
        engine.start(interval_seconds=1)
        
        # Measure process stats over time
        start_time = time.time()
        stats = []
        
        try:
            # Monitor for 5 seconds
            for _ in range(5):
                time.sleep(1)
                process = psutil.Process(os.getpid())
                cpu_percent = process.cpu_percent()
                memory_mb = process.memory_info().rss / 1024 / 1024
                
                stats.append({
                    "timestamp": time.time() - start_time,
                    "cpu_percent": cpu_percent,
                    "memory_mb": memory_mb
                })
        finally:
            # Stop the scheduler
            engine.stop()
        
        # Calculate averages
        avg_cpu = sum(s["cpu_percent"] for s in stats) / len(stats)
        avg_memory = sum(s["memory_mb"] for s in stats) / len(stats)
        
        # Get engine status
        status = engine.get_status()
        
        # Log performance results
        performance = {
            "duration_seconds": time.time() - start_time,
            "measurement_count": len(stats),
            "avg_cpu_percent": avg_cpu,
            "avg_memory_mb": avg_memory,
            "min_cpu_percent": min(s["cpu_percent"] for s in stats),
            "max_cpu_percent": max(s["cpu_percent"] for s in stats),
            "min_memory_mb": min(s["memory_mb"] for s in stats),
            "max_memory_mb": max(s["memory_mb"] for s in stats),
            "stats": stats,
            "sync_count": len(engine.sync_history.results)
        }
        
        # Write to performance log
        self._log_performance_result("scheduler_performance", performance)
        
        # Print result for debugging
        print(f"\nScheduler performance:")
        print(f"  Sync operations: {len(engine.sync_history.results)}")
        print(f"  Avg CPU usage: {avg_cpu:.2f}%")
        print(f"  Avg Memory usage: {avg_memory:.2f} MB")
    
    def _log_performance_result(self, test_name, data):
        """Log performance test results to a file."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_dir = os.path.join(os.path.dirname(__file__), "../../reports/performance")
        
        # Create directory if it doesn't exist
        os.makedirs(log_dir, exist_ok=True)
        
        # Create the log file
        log_file = os.path.join(log_dir, f"{test_name}_{timestamp}.json")
        
        # Add metadata
        data["test_name"] = test_name
        data["timestamp"] = timestamp
        
        # Write to file
        with open(log_file, 'w') as f:
            json.dump(data, f, indent=2)