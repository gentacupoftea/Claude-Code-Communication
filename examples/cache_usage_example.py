#!/usr/bin/env python3
"""
Shopify MCP Server Cache System Usage Example.

This example demonstrates how to use the cache system components
to build a complete caching solution for a web application.
"""

import os
import sys
import time
import random
import logging
from typing import Dict, Any, List

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import cache components
from src.cache import (
    CacheFactory, 
    CacheManager, 
    OptimizedCacheManager,
    CacheDependencyTracker,
    CacheMetricsCollector,
    CacheDashboard
)


def setup_logging():
    """Configure logging for the example."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('cache_example.log')
        ]
    )
    return logging.getLogger('cache_example')


def load_cache_config() -> Dict[str, Any]:
    """Load cache configuration (simulated)."""
    return {
        'type': 'optimized',
        'memory_cache_size': 10000,
        'redis_ttl': 3600,
        'memory_ttl': 300,
        'enable_compression': True,
        'compression_min_size': 1024,
        'enable_adaptive_ttl': True,
        'redis': {
            'host': 'localhost',
            'port': 6379,
            'db': 0,
            'socket_timeout': 2.0,
            'connection_pool_size': 10
        },
        'enable_dependency_tracking': True,
        'dependency_tracker': {
            'dependency_ttl': 86400,
            'max_dependencies_per_key': 1000,
            'dependency_cleanup_interval': 3600
        }
    }


def simulate_product_data(product_id: int) -> Dict[str, Any]:
    """Generate simulated product data."""
    return {
        'id': product_id,
        'name': f'Product {product_id}',
        'price': round(random.uniform(10, 1000), 2),
        'inventory': random.randint(0, 100),
        'category_id': random.randint(1, 10),
        'brand_id': random.randint(1, 5),
        'updated_at': time.time()
    }


def simulate_category_data(category_id: int) -> Dict[str, Any]:
    """Generate simulated category data."""
    return {
        'id': category_id,
        'name': f'Category {category_id}',
        'parent_id': None if category_id <= 3 else random.randint(1, 3),
        'product_count': random.randint(10, 100),
        'updated_at': time.time()
    }


def simulate_api_requests(
    cache_manager: OptimizedCacheManager,
    dependency_tracker: CacheDependencyTracker,
    logger: logging.Logger
) -> None:
    """Simulate API requests that use the cache system."""
    # Simulate product API endpoints
    def get_product(product_id: int) -> Dict[str, Any]:
        """Get product by ID with caching."""
        cache_key = f'product:{product_id}'
        product = cache_manager.get(cache_key)
        
        if product is None:
            logger.info(f"Cache miss for product {product_id}, fetching from database")
            # Simulate database fetch
            product = simulate_product_data(product_id)
            
            # Cache the product (5 minute TTL)
            cache_manager.set(cache_key, product, ttl=300)
            
            # Register dependencies
            category_id = product['category_id']
            brand_id = product['brand_id']
            
            dependency_tracker.register_multiple_dependencies(
                key=cache_key,
                depends_on_keys=[
                    f'category:{category_id}',
                    f'brand:{brand_id}',
                    'product_list'
                ]
            )
        else:
            logger.info(f"Cache hit for product {product_id}")
        
        return product
    
    def get_category_products(category_id: int) -> List[Dict[str, Any]]:
        """Get products in a category with caching."""
        cache_key = f'category_products:{category_id}'
        products = cache_manager.get(cache_key)
        
        if products is None:
            logger.info(f"Cache miss for category products {category_id}, fetching from database")
            # Simulate database fetch
            product_ids = random.sample(range(1, 100), 10)
            products = [simulate_product_data(pid) for pid in product_ids]
            
            # Cache the products (10 minute TTL)
            cache_manager.set(cache_key, products, ttl=600)
            
            # Register dependency on the category
            dependency_tracker.register_dependency(
                key=cache_key,
                depends_on_key=f'category:{category_id}'
            )
        else:
            logger.info(f"Cache hit for category products {category_id}")
        
        return products
    
    def update_product(product_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a product and invalidate cache."""
        # Simulate database update
        product = simulate_product_data(product_id)
        product.update(data)
        
        # Invalidate product cache with dependencies
        cache_key = f'product:{product_id}'
        dependency_tracker.invalidate_with_dependencies(cache_key)
        
        logger.info(f"Updated product {product_id} and invalidated cache")
        return product
    
    def update_category(category_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a category and invalidate cache."""
        # Simulate database update
        category = simulate_category_data(category_id)
        category.update(data)
        
        # Invalidate category cache with dependencies
        cache_key = f'category:{category_id}'
        count = dependency_tracker.invalidate_with_dependencies(cache_key)
        
        logger.info(f"Updated category {category_id} and invalidated {count} cache entries")
        return category
    
    # Simulate a series of API requests
    logger.info("Starting API request simulation")
    
    # Fetch some products (will be cache misses)
    for i in range(1, 6):
        get_product(i)
    
    # Fetch some category products (will be cache misses)
    for i in range(1, 4):
        get_category_products(i)
    
    # Fetch the same products again (will be cache hits)
    for i in range(1, 6):
        get_product(i)
    
    # Update a product
    update_product(3, {'price': 499.99, 'inventory': 42})
    
    # Fetch the updated product (will be a cache miss due to invalidation)
    get_product(3)
    
    # Update a category
    update_category(2, {'name': 'Updated Category 2'})
    
    # Fetch products in the updated category (will be a cache miss)
    get_category_products(2)
    
    logger.info("Completed API request simulation")


def main():
    """Run the cache usage example."""
    logger = setup_logging()
    logger.info("Starting cache system example")
    
    try:
        # Load configuration
        config = load_cache_config()
        logger.info("Loaded cache configuration")
        
        # Create cache system
        try:
            # Use CacheFactory to create cache system
            cache_system = CacheFactory.create_full_cache_system(config)
            cache_manager = cache_system['cache_manager']
            dependency_tracker = cache_system['dependency_tracker']
            
            logger.info("Created cache system")
            
            # Create metrics collector
            metrics_collector = CacheMetricsCollector(
                cache_manager=cache_manager,
                metrics_namespace="example_cache",
                collection_interval=10,  # collect metrics every 10 seconds
                retention_period=3600,   # retain metrics for 1 hour
                enable_periodic_collection=True
            )
            logger.info("Started metrics collection")
            
            # Create dashboard
            dashboard = CacheDashboard(
                metrics_collector=metrics_collector,
                dashboard_title="Cache Performance Dashboard",
                refresh_interval=10
            )
            logger.info("Created performance dashboard")
            
            # Simulate API requests that use the cache
            simulate_api_requests(cache_manager, dependency_tracker, logger)
            
            # Wait for metrics collection
            logger.info("Waiting for metrics collection...")
            time.sleep(30)
            
            # Generate reports
            dashboard.save_dashboard_html("cache_dashboard.html")
            dashboard.save_text_report("cache_report.txt")
            logger.info("Generated dashboard and report")
            
            # Display some metrics
            metrics = metrics_collector.get_aggregated_metrics(60)
            logger.info(f"Cache hit rate: {metrics.get('hit_rate', {}).get('avg', 0):.1%}")
            
            # Check for alerts
            alerts = metrics_collector.get_alert_conditions()
            if alerts:
                logger.warning(f"Found {len(alerts)} alert conditions")
                for alert in alerts:
                    logger.warning(f"[{alert['severity']}] {alert['description']}")
            else:
                logger.info("No alert conditions detected")
            
        except ImportError:
            # Fallback if Redis is not available (for demo purposes)
            logger.warning("Redis not available, using mock for example")
            from unittest import mock
            
            mock_redis = mock.MagicMock()
            cache_manager = OptimizedCacheManager(
                redis_client=mock_redis,
                memory_cache_size=10000,
                redis_ttl=3600,
                memory_ttl=300
            )
            dependency_tracker = CacheDependencyTracker(cache_manager)
            
            # Run the simulation
            simulate_api_requests(cache_manager, dependency_tracker, logger)
        
        logger.info("Cache system example completed successfully")
        
    except Exception as e:
        logger.exception(f"Error in cache example: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())