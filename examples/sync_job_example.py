#!/usr/bin/env python3
"""
Shopify MCP Server - Sync Job Setup and Execution Example

This script demonstrates how to set up and run synchronization jobs
to keep Shopify data in sync with external platforms.
"""

import os
import sys
import time
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sync_example")


# Import necessary components
from src.sync.sync_manager import SyncManager, SyncDirection, SyncStatus
from src.sync.sync_scheduler import SyncScheduler
from src.sync.sync_metrics_collector import SyncMetricsCollector
from src.api.shopify_api import ShopifyAPI


class ExternalPlatformAPI:
    """
    Simulated external platform API client.
    In a real scenario, this would interact with an actual third-party platform.
    """
    
    def __init__(self, api_key: str, api_secret: str, platform_url: str):
        """Initialize the external platform API client."""
        self.api_key = api_key
        self.api_secret = api_secret
        self.platform_url = platform_url
        self.logger = logging.getLogger("external_platform")
    
    async def initialize(self) -> bool:
        """Initialize the API connection."""
        self.logger.info(f"Initializing connection to {self.platform_url}")
        # In a real implementation, this would establish a connection
        # or validate credentials with the external platform
        await asyncio.sleep(0.5)  # Simulate API latency
        return True
    
    async def get_products(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get products from the external platform."""
        self.logger.info(f"Fetching products (limit={limit}, offset={offset})")
        # In a real implementation, this would fetch actual products
        await asyncio.sleep(0.3)  # Simulate API latency
        
        # Generate mock product data
        products = []
        for i in range(offset, offset + limit):
            if i >= 150:  # Simulate only having 150 products total
                break
                
            products.append({
                "id": f"ext-{i}",
                "sku": f"SKU-{i}",
                "title": f"External Product {i}",
                "description": f"Description for product {i}",
                "price": round(10 + (i % 10) * 5.99, 2),
                "inventory_quantity": (i % 5) * 10 + 5,
                "updated_at": datetime.now().isoformat()
            })
        
        return products
    
    async def update_product(self, product_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a product on the external platform."""
        self.logger.info(f"Updating product {product_id}")
        # In a real implementation, this would update the actual product
        await asyncio.sleep(0.2)  # Simulate API latency
        
        return {
            "id": product_id,
            "status": "updated",
            "updated_at": datetime.now().isoformat(),
            **data
        }
    
    async def create_product(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a product on the external platform."""
        self.logger.info(f"Creating product: {data.get('title', 'Unknown')}")
        # In a real implementation, this would create the actual product
        await asyncio.sleep(0.4)  # Simulate API latency
        
        # Generate a new ID for the product
        new_id = f"ext-{int(time.time())}"
        
        return {
            "id": new_id,
            "status": "created",
            "created_at": datetime.now().isoformat(),
            **data
        }
    
    async def get_orders(self, since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Get orders from the external platform."""
        since_str = since.isoformat() if since else "all time"
        self.logger.info(f"Fetching orders since {since_str}")
        # In a real implementation, this would fetch actual orders
        await asyncio.sleep(0.3)  # Simulate API latency
        
        # Generate mock order data
        orders = []
        for i in range(10):  # Simulate 10 orders
            order_date = datetime.now() - timedelta(days=i % 7, hours=i)
            
            if since and order_date < since:
                continue
                
            orders.append({
                "id": f"order-{i}",
                "order_number": f"EXT-{1000 + i}",
                "customer": {
                    "id": f"cust-{i % 5}",
                    "email": f"customer{i % 5}@example.com",
                    "name": f"Customer {i % 5}"
                },
                "total": round(50 + (i % 5) * 25.50, 2),
                "items": [
                    {
                        "product_id": f"ext-{i * 2}",
                        "quantity": 1,
                        "price": 29.99
                    },
                    {
                        "product_id": f"ext-{i * 2 + 1}",
                        "quantity": 2,
                        "price": 19.99
                    }
                ],
                "created_at": order_date.isoformat()
            })
        
        return orders
    
    async def update_inventory(self, updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update inventory for multiple products."""
        product_ids = [update.get("product_id") for update in updates]
        self.logger.info(f"Updating inventory for {len(updates)} products")
        self.logger.debug(f"Product IDs: {', '.join(product_ids)}")
        
        # In a real implementation, this would update actual inventory
        await asyncio.sleep(0.3)  # Simulate API latency
        
        results = {
            "successful": [],
            "failed": []
        }
        
        # Simulate mostly successful updates with a few random failures
        for update in updates:
            product_id = update.get("product_id")
            if product_id.endswith("7"):  # Simulate occasional failures
                results["failed"].append({
                    "product_id": product_id,
                    "error": "Inventory update failed: API timeout"
                })
            else:
                results["successful"].append({
                    "product_id": product_id,
                    "new_quantity": update.get("quantity", 0)
                })
        
        return {
            "status": "completed",
            "processed": len(updates),
            "successful": len(results["successful"]),
            "failed": len(results["failed"]),
            "results": results
        }


class ShopifyMockAPI:
    """
    Simulated Shopify API client for demonstration purposes.
    In a real scenario, we would use the actual ShopifyAPI class.
    """
    
    def __init__(self):
        """Initialize the Shopify API client."""
        self.logger = logging.getLogger("shopify_mock")
    
    async def get_products(self, limit: int = 100, page: int = 1) -> Dict[str, Any]:
        """Get products from Shopify."""
        offset = (page - 1) * limit
        self.logger.info(f"Fetching Shopify products (limit={limit}, page={page})")
        await asyncio.sleep(0.3)  # Simulate API latency
        
        # Generate mock product data
        products = []
        for i in range(offset, offset + limit):
            if i >= 120:  # Simulate only having 120 products
                break
                
            products.append({
                "id": i,
                "title": f"Shopify Product {i}",
                "body_html": f"<p>Description for product {i}</p>",
                "vendor": f"Vendor {i % 5}",
                "product_type": f"Type {i % 3}",
                "handle": f"shopify-product-{i}",
                "variants": [
                    {
                        "id": i * 100,
                        "sku": f"SKU-SH-{i}",
                        "price": str(round(15 + (i % 10) * 6.99, 2)),
                        "inventory_quantity": (i % 5) * 8 + 2,
                        "grams": 500,
                        "requires_shipping": True
                    }
                ],
                "created_at": (datetime.now() - timedelta(days=i % 30)).isoformat(),
                "updated_at": (datetime.now() - timedelta(days=i % 10)).isoformat()
            })
        
        return {
            "products": products,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": 120,
                "pages": (120 + limit - 1) // limit
            }
        }
    
    async def get_orders(self, limit: int = 50, status: str = "any", since_id: Optional[int] = None) -> Dict[str, Any]:
        """Get orders from Shopify."""
        self.logger.info(f"Fetching Shopify orders (limit={limit}, status={status}, since_id={since_id})")
        await asyncio.sleep(0.3)  # Simulate API latency
        
        # Generate mock order data
        orders = []
        start_id = since_id or 1001
        
        for i in range(min(limit, 80)):  # Simulate having 80 orders total
            order_id = start_id + i
            order_date = datetime.now() - timedelta(days=i % 14, hours=i)
            
            order = {
                "id": order_id,
                "name": f"#{order_id}",
                "customer": {
                    "id": i % 10 + 100,
                    "email": f"customer{i % 10}@example.com",
                    "first_name": f"First{i % 10}",
                    "last_name": f"Last{i % 10}"
                },
                "line_items": [
                    {
                        "id": order_id * 100 + j,
                        "product_id": (i * j) % 120,
                        "variant_id": (i * j) % 120 * 100,
                        "title": f"Shopify Product {(i * j) % 120}",
                        "quantity": j + 1,
                        "price": str(round(15 + ((i * j) % 10) * 6.99, 2))
                    } for j in range(1, 3)  # 2 items per order
                ],
                "total_price": str(round(40 + (i % 10) * 15.75, 2)),
                "created_at": order_date.isoformat(),
                "updated_at": order_date.isoformat(),
                "financial_status": ["paid", "pending", "refunded"][i % 3],
                "fulfillment_status": ["fulfilled", "partial", None][i % 3]
            }
            
            orders.append(order)
        
        return {
            "orders": orders,
            "pagination": {
                "limit": limit,
                "since_id": start_id,
                "next_since_id": start_id + len(orders) if len(orders) > 0 else None
            }
        }
    
    async def update_inventory(self, inventory_item_id: int, location_id: int, quantity: int) -> Dict[str, Any]:
        """Update inventory for a Shopify product."""
        self.logger.info(f"Updating Shopify inventory (item={inventory_item_id}, location={location_id}, quantity={quantity})")
        await asyncio.sleep(0.2)  # Simulate API latency
        
        return {
            "inventory_level": {
                "inventory_item_id": inventory_item_id,
                "location_id": location_id,
                "available": quantity,
                "updated_at": datetime.now().isoformat()
            }
        }


class SyncJobExample:
    """Example class demonstrating sync job setup and execution."""
    
    def __init__(self):
        """Initialize the sync job example."""
        self.logger = logging.getLogger("sync_job_example")
        
        # Create mock APIs
        self.shopify_api = ShopifyMockAPI()
        self.external_api = ExternalPlatformAPI(
            api_key="demo_key",
            api_secret="demo_secret",
            platform_url="https://api.external-platform.example.com"
        )
        
        # Create a sync manager
        # In a real scenario, these would come from a ConfigManager
        config = {
            "sync": {
                "batch_size": 50,
                "error_retry_delay": 60,
                "max_retries": 3,
                "default_interval": 300,
                "max_concurrent_jobs": 3
            }
        }
        
        # Create a mock cache manager for demonstration
        cache_manager = type('MockCacheManager', (), {
            'get': lambda s, k: None,
            'set': lambda s, k, v, ttl=None: None,
            'delete': lambda s, k: None,
            'shutdown': lambda s: None
        })()
        
        self.sync_manager = SyncManager(config, cache_manager, self.logger)
        self.metrics_collector = SyncMetricsCollector(self.sync_manager, collection_interval=5)
    
    async def setup(self):
        """Set up the sync job example."""
        self.logger.info("Initializing sync job example")
        
        # Initialize external API
        await self.external_api.initialize()
        
        # Register APIs with the sync manager
        self.sync_manager.register_shopify_api(self.shopify_api)
        self.sync_manager.register_external_api("example_platform", self.external_api)
        
        # Register sync transformers (in a real scenario)
        # self.sync_manager.register_transformer("product", ProductTransformer())
        # self.sync_manager.register_transformer("order", OrderTransformer())
        # self.sync_manager.register_transformer("inventory", InventoryTransformer())
        
        # Start metrics collection
        self.metrics_collector.start_collection()
    
    async def run_product_sync_job(self):
        """Run a product synchronization job."""
        self.logger.info("Starting product sync job (Shopify to External)")
        
        # Define job configuration
        job_config = {
            "entity_type": "product",
            "direction": SyncDirection.SHOPIFY_TO_EXTERNAL.value,
            "batch_size": 20,
            "options": {
                "fields": ["title", "variants", "images", "product_type"],
                "sync_inventory": True,
                "skip_existing": False,
                "handle_conflicts": "shopify_wins"
            }
        }
        
        # Create the job
        job_id = self.sync_manager.create_sync_job(job_config)
        self.logger.info(f"Created product sync job with ID: {job_id}")
        
        # Start the job
        self.sync_manager.start_job(job_id)
        
        # Monitor job progress
        while True:
            job_status = self.sync_manager.get_job_status(job_id)
            progress = job_status.get("progress", 0)
            status = job_status.get("status")
            
            self.logger.info(f"Job {job_id} status: {status}, progress: {progress}%")
            
            if status in [SyncStatus.COMPLETED.value, SyncStatus.FAILED.value, SyncStatus.CANCELLED.value]:
                break
                
            await asyncio.sleep(1)
        
        # Get final job results
        job_result = self.sync_manager.get_job_result(job_id)
        
        self.logger.info(f"Product sync job {job_id} completed with status: {job_result['status']}")
        self.logger.info(f"Processed {job_result.get('processed_entities', 0)} products")
        self.logger.info(f"Successful: {job_result.get('successful_entities', 0)}")
        self.logger.info(f"Failed: {job_result.get('failed_entities', 0)}")
        
        return job_result
    
    async def run_order_sync_job(self):
        """Run an order synchronization job."""
        self.logger.info("Starting order sync job (External to Shopify)")
        
        # Define job configuration
        job_config = {
            "entity_type": "order",
            "direction": SyncDirection.EXTERNAL_TO_SHOPIFY.value,
            "batch_size": 10,
            "options": {
                "since_date": (datetime.now() - timedelta(days=7)).isoformat(),
                "order_status": ["paid", "partially_paid"],
                "include_customer_data": True
            }
        }
        
        # Create the job
        job_id = self.sync_manager.create_sync_job(job_config)
        self.logger.info(f"Created order sync job with ID: {job_id}")
        
        # Start the job
        self.sync_manager.start_job(job_id)
        
        # Monitor job progress
        while True:
            job_status = self.sync_manager.get_job_status(job_id)
            progress = job_status.get("progress", 0)
            status = job_status.get("status")
            
            self.logger.info(f"Job {job_id} status: {status}, progress: {progress}%")
            
            if status in [SyncStatus.COMPLETED.value, SyncStatus.FAILED.value, SyncStatus.CANCELLED.value]:
                break
                
            await asyncio.sleep(1)
        
        # Get final job results
        job_result = self.sync_manager.get_job_result(job_id)
        
        self.logger.info(f"Order sync job {job_id} completed with status: {job_result['status']}")
        self.logger.info(f"Processed {job_result.get('processed_entities', 0)} orders")
        self.logger.info(f"Successful: {job_result.get('successful_entities', 0)}")
        self.logger.info(f"Failed: {job_result.get('failed_entities', 0)}")
        
        return job_result
    
    async def run_inventory_sync_job(self):
        """Run an inventory synchronization job."""
        self.logger.info("Starting inventory sync job (Bidirectional)")
        
        # Define job configuration
        job_config = {
            "entity_type": "inventory",
            "direction": SyncDirection.BIDIRECTIONAL.value,
            "batch_size": 50,
            "options": {
                "conflict_resolution": "most_recent_wins",
                "include_product_ids": [],  # Empty means all products
                "locations": ["primary"]
            }
        }
        
        # Create the job
        job_id = self.sync_manager.create_sync_job(job_config)
        self.logger.info(f"Created inventory sync job with ID: {job_id}")
        
        # Start the job
        self.sync_manager.start_job(job_id)
        
        # Monitor job progress
        while True:
            job_status = self.sync_manager.get_job_status(job_id)
            progress = job_status.get("progress", 0)
            status = job_status.get("status")
            
            self.logger.info(f"Job {job_id} status: {status}, progress: {progress}%")
            
            if status in [SyncStatus.COMPLETED.value, SyncStatus.FAILED.value, SyncStatus.CANCELLED.value]:
                break
                
            await asyncio.sleep(1)
        
        # Get final job results
        job_result = self.sync_manager.get_job_result(job_id)
        
        self.logger.info(f"Inventory sync job {job_id} completed with status: {job_result['status']}")
        self.logger.info(f"Processed {job_result.get('processed_entities', 0)} inventory items")
        self.logger.info(f"Successful: {job_result.get('successful_entities', 0)}")
        self.logger.info(f"Failed: {job_result.get('failed_entities', 0)}")
        
        return job_result
    
    async def setup_scheduled_jobs(self):
        """Set up scheduled sync jobs using SyncScheduler."""
        self.logger.info("Setting up scheduled sync jobs")
        
        # In a real scenario, these settings would come from a configuration file
        scheduler_config = {
            "sync": {
                "enabled": True,
                "default_interval": 3600,  # Every hour
                "max_concurrent_jobs": 2,
                "jobs": {
                    "products": {
                        "enabled": True,
                        "interval": 86400,  # Daily
                        "time": "01:00",  # At 1 AM
                        "options": {
                            "direction": SyncDirection.SHOPIFY_TO_EXTERNAL.value,
                            "entity_type": "product",
                            "batch_size": 100
                        }
                    },
                    "orders": {
                        "enabled": True,
                        "interval": 1800,  # Every 30 minutes
                        "options": {
                            "direction": SyncDirection.BIDIRECTIONAL.value,
                            "entity_type": "order",
                            "batch_size": 50,
                            "since_date": "1h"  # Last hour
                        }
                    },
                    "inventory": {
                        "enabled": True,
                        "interval": 600,  # Every 10 minutes
                        "options": {
                            "direction": SyncDirection.BIDIRECTIONAL.value,
                            "entity_type": "inventory",
                            "batch_size": 200
                        }
                    }
                }
            }
        }
        
        # Create a scheduler
        scheduler = SyncScheduler(self.sync_manager, scheduler_config)
        
        # Start the scheduler
        scheduler.start()
        self.logger.info("Sync scheduler started")
        
        # Show scheduled jobs
        jobs = scheduler.get_scheduled_jobs()
        self.logger.info(f"Scheduled jobs: {len(jobs)}")
        
        for job_name, job_info in jobs.items():
            self.logger.info(f"Job '{job_name}':")
            self.logger.info(f"  Interval: {job_info.get('interval')} seconds")
            self.logger.info(f"  Next run: {job_info.get('next_run')}")
            self.logger.info(f"  Entity type: {job_info.get('options', {}).get('entity_type')}")
            self.logger.info(f"  Direction: {job_info.get('options', {}).get('direction')}")
        
        # Let the scheduler run for a while
        self.logger.info("Letting scheduler run for 10 seconds...")
        await asyncio.sleep(10)
        
        # Stop the scheduler
        scheduler.stop()
        self.logger.info("Sync scheduler stopped")
    
    async def generate_sync_report(self):
        """Generate a sync report from collected metrics."""
        self.logger.info("Generating sync report")
        
        # Get metrics from the collector
        metrics = self.metrics_collector.get_aggregated_metrics(time_window=60)
        
        # Create a report
        report = {
            "timestamp": datetime.now().isoformat(),
            "sync_performance": {
                "success_rate": metrics.get("success_rate", {}).get("avg", 0) * 100,
                "average_duration": metrics.get("duration", {}).get("avg", 0),
                "entities_per_second": metrics.get("entities_per_second", {}).get("avg", 0)
            },
            "api_performance": {
                "shopify_avg_duration": metrics.get("shopify_api_duration", {}).get("avg", 0),
                "external_avg_duration": metrics.get("external_api_duration", {}).get("avg", 0),
                "shopify_success_rate": metrics.get("shopify_api_success_rate", {}).get("avg", 0) * 100,
                "external_success_rate": metrics.get("external_api_success_rate", {}).get("avg", 0) * 100
            },
            "errors": {
                "top_error_types": metrics.get("top_error_types", {}),
                "error_rate": metrics.get("error_rate", {}).get("avg", 0) * 100
            },
            "entity_types": {
                "product": {
                    "count": metrics.get("product_count", {}).get("sum", 0),
                    "success_rate": metrics.get("product_success_rate", {}).get("avg", 0) * 100
                },
                "order": {
                    "count": metrics.get("order_count", {}).get("sum", 0),
                    "success_rate": metrics.get("order_success_rate", {}).get("avg", 0) * 100
                },
                "inventory": {
                    "count": metrics.get("inventory_count", {}).get("sum", 0),
                    "success_rate": metrics.get("inventory_success_rate", {}).get("avg", 0) * 100
                }
            }
        }
        
        # Print the report
        print("\n===== SYNC PERFORMANCE REPORT =====")
        print(f"Generated at: {report['timestamp']}")
        print("\nSync Performance:")
        print(f"  Success Rate: {report['sync_performance']['success_rate']:.1f}%")
        print(f"  Average Duration: {report['sync_performance']['average_duration']:.2f} seconds")
        print(f"  Entities Per Second: {report['sync_performance']['entities_per_second']:.2f}")
        
        print("\nAPI Performance:")
        print(f"  Shopify Avg Duration: {report['api_performance']['shopify_avg_duration']:.2f} seconds")
        print(f"  External Avg Duration: {report['api_performance']['external_avg_duration']:.2f} seconds")
        print(f"  Shopify Success Rate: {report['api_performance']['shopify_success_rate']:.1f}%")
        print(f"  External Success Rate: {report['api_performance']['external_success_rate']:.1f}%")
        
        print("\nErrors:")
        print(f"  Error Rate: {report['errors']['error_rate']:.1f}%")
        print("  Top Error Types:")
        for error_type, count in report['errors'].get('top_error_types', {}).items():
            print(f"    - {error_type}: {count}")
        
        print("\nEntity Types:")
        for entity_type, data in report['entity_types'].items():
            print(f"  {entity_type.title()}:")
            print(f"    Count: {data['count']}")
            print(f"    Success Rate: {data['success_rate']:.1f}%")
        
        print("\n===================================\n")
        
        # Save the report to a file
        report_file = "sync_report.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)
            
        self.logger.info(f"Sync report saved to {report_file}")
    
    async def cleanup(self):
        """Clean up resources."""
        self.logger.info("Cleaning up resources")
        
        # Stop metrics collection
        self.metrics_collector.stop_collection()
        
        # Cancel any running jobs
        for job_id in self.sync_manager.get_active_job_ids():
            self.sync_manager.cancel_job(job_id)
            self.logger.info(f"Cancelled job {job_id}")
        
        self.logger.info("Cleanup completed")


async def main():
    """Main function to run the example."""
    print("Shopify MCP Server - Sync Job Setup and Execution Example")
    
    example = SyncJobExample()
    
    try:
        # Set up the example
        await example.setup()
        
        # Run a product sync job
        await example.run_product_sync_job()
        
        # Run an order sync job
        await example.run_order_sync_job()
        
        # Run an inventory sync job
        await example.run_inventory_sync_job()
        
        # Set up scheduled jobs
        await example.setup_scheduled_jobs()
        
        # Generate a sync report
        await example.generate_sync_report()
        
    finally:
        # Clean up
        await example.cleanup()
    
    print("\nSync job example completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())