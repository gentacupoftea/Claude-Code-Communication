#!/usr/bin/env python3
"""
Shopify MCP Server - Optimized Cache Usage Example

This script demonstrates how to effectively use the caching system 
in the Shopify MCP Server to improve performance and reduce API calls.
"""

import os
import sys
import time
import json
import random
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('cache_example.log')
    ]
)
logger = logging.getLogger("cache_example")

# Import cache components
from src.cache.cache_factory import CacheFactory
from src.cache.optimized_cache_manager import OptimizedCacheManager
from src.cache.cache_dependency_tracker import CacheDependencyTracker
from src.cache.cache_metrics_collector import CacheMetricsCollector


class ShopifyAPISimulator:
    """
    Simulates the Shopify API for demonstration purposes.
    In a real scenario, this would be the actual Shopify API client.
    """
    
    def __init__(self, shop_url: str, access_token: str):
        """Initialize the Shopify API simulator."""
        self.shop_url = shop_url
        self.access_token = access_token
        self.logger = logging.getLogger("shopify_api")
        self.call_count = 0
        self.call_duration = 0
        
        # Simulated database
        self._products = {}
        self._orders = {}
        self._customers = {}
        
        # Generate sample data
        self._generate_sample_data()
    
    def _generate_sample_data(self):
        """Generate sample data for simulation."""
        # Products
        for i in range(1, 201):  # 200 products
            product_id = i
            self._products[product_id] = {
                "id": product_id,
                "title": f"Product {product_id}",
                "handle": f"product-{product_id}",
                "product_type": f"Type {i % 5 + 1}",
                "vendor": f"Vendor {i % 10 + 1}",
                "price": round(10 + (i % 10) * 5.99, 2),
                "inventory_quantity": (i % 20) * 5 + 10,
                "created_at": (datetime.now() - timedelta(days=i % 100)).isoformat(),
                "updated_at": (datetime.now() - timedelta(hours=i % 24)).isoformat()
            }
        
        # Orders
        for i in range(1, 101):  # 100 orders
            order_id = 1000 + i
            customer_id = (i % 20) + 1
            
            order_items = []
            for j in range(1, random.randint(1, 5)):
                product_id = random.randint(1, 200)
                product = self._products[product_id]
                order_items.append({
                    "product_id": product_id,
                    "title": product["title"],
                    "quantity": random.randint(1, 3),
                    "price": product["price"]
                })
            
            self._orders[order_id] = {
                "id": order_id,
                "customer_id": customer_id,
                "order_number": f"#{order_id}",
                "items": order_items,
                "total_price": sum(item["price"] * item["quantity"] for item in order_items),
                "created_at": (datetime.now() - timedelta(days=i % 30)).isoformat(),
                "status": random.choice(["pending", "paid", "fulfilled"])
            }
        
        # Customers
        for i in range(1, 21):  # 20 customers
            customer_id = i
            self._customers[customer_id] = {
                "id": customer_id,
                "email": f"customer{i}@example.com",
                "first_name": f"First{i}",
                "last_name": f"Last{i}",
                "total_orders": random.randint(1, 10),
                "created_at": (datetime.now() - timedelta(days=i * 10)).isoformat()
            }
    
    async def get_product(self, product_id: int) -> Dict[str, Any]:
        """Get a product by ID."""
        await self._simulate_api_call()
        
        if product_id in self._products:
            return self._products[product_id]
        
        raise Exception(f"Product not found: {product_id}")
    
    async def get_products(self, limit: int = 10, page: int = 1, **filters) -> Dict[str, Any]:
        """Get a list of products."""
        await self._simulate_api_call(duration_factor=1.5)
        
        offset = (page - 1) * limit
        
        # Apply filters if provided
        filtered_products = self._products.values()
        
        if "vendor" in filters:
            filtered_products = [p for p in filtered_products if p["vendor"] == filters["vendor"]]
        
        if "product_type" in filters:
            filtered_products = [p for p in filtered_products if p["product_type"] == filters["product_type"]]
        
        # Sort by ID for consistent pagination
        sorted_products = sorted(filtered_products, key=lambda p: p["id"])
        
        # Apply pagination
        paginated_products = sorted_products[offset:offset + limit]
        
        return {
            "products": paginated_products,
            "count": len(filtered_products),
            "page": page,
            "limit": limit,
            "pages": (len(filtered_products) + limit - 1) // limit
        }
    
    async def get_order(self, order_id: int) -> Dict[str, Any]:
        """Get an order by ID."""
        await self._simulate_api_call()
        
        if order_id in self._orders:
            return self._orders[order_id]
        
        raise Exception(f"Order not found: {order_id}")
    
    async def get_orders(self, limit: int = 10, page: int = 1, **filters) -> Dict[str, Any]:
        """Get a list of orders."""
        await self._simulate_api_call(duration_factor=1.5)
        
        offset = (page - 1) * limit
        
        # Apply filters if provided
        filtered_orders = self._orders.values()
        
        if "status" in filters:
            filtered_orders = [o for o in filtered_orders if o["status"] == filters["status"]]
        
        if "customer_id" in filters:
            filtered_orders = [o for o in filtered_orders if o["customer_id"] == filters["customer_id"]]
        
        # Sort by ID for consistent pagination
        sorted_orders = sorted(filtered_orders, key=lambda o: o["id"])
        
        # Apply pagination
        paginated_orders = sorted_orders[offset:offset + limit]
        
        return {
            "orders": paginated_orders,
            "count": len(filtered_orders),
            "page": page,
            "limit": limit,
            "pages": (len(filtered_orders) + limit - 1) // limit
        }
    
    async def get_customer(self, customer_id: int) -> Dict[str, Any]:
        """Get a customer by ID."""
        await self._simulate_api_call()
        
        if customer_id in self._customers:
            return self._customers[customer_id]
        
        raise Exception(f"Customer not found: {customer_id}")
    
    async def get_customer_orders(self, customer_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get orders for a customer."""
        await self._simulate_api_call(duration_factor=1.2)
        
        return await self.get_orders(limit=limit, customer_id=customer_id)
    
    async def _simulate_api_call(self, duration_factor: float = 1.0):
        """Simulate an API call with latency."""
        self.call_count += 1
        
        # Simulate API latency
        duration = random.uniform(0.1, 0.3) * duration_factor
        await asyncio.sleep(duration)
        
        self.call_duration += duration
        self.logger.debug(f"API call #{self.call_count} took {duration:.2f}s")


class CachedShopifyClient:
    """
    A client that uses the cache system to optimize Shopify API calls.
    """
    
    def __init__(self, api: ShopifyAPISimulator, cache_manager: OptimizedCacheManager, dependency_tracker: CacheDependencyTracker):
        """Initialize the cached Shopify client."""
        self.api = api
        self.cache = cache_manager
        self.dependencies = dependency_tracker
        self.logger = logging.getLogger("cached_client")
    
    async def get_product(self, product_id: int) -> Dict[str, Any]:
        """Get a product by ID with caching."""
        cache_key = f"product:{product_id}"
        product = self.cache.get(cache_key)
        
        if product is not None:
            self.logger.info(f"Cache HIT for product {product_id}")
            return product
        
        self.logger.info(f"Cache MISS for product {product_id}, fetching from API")
        product = await self.api.get_product(product_id)
        
        # Cache the product
        self.cache.set(cache_key, product, ttl=300)  # 5 minutes TTL
        
        # Register dependencies
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key=f"product_type:{product['product_type']}"
        )
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key=f"vendor:{product['vendor']}"
        )
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key="all_products"
        )
        
        return product
    
    async def get_products(self, limit: int = 10, page: int = 1, **filters) -> Dict[str, Any]:
        """Get a list of products with caching."""
        # Create a cache key that incorporates the filters
        filter_str = "&".join(f"{k}={v}" for k, v in sorted(filters.items()))
        cache_key = f"products:limit={limit}:page={page}:{filter_str}"
        
        products_result = self.cache.get(cache_key)
        
        if products_result is not None:
            self.logger.info(f"Cache HIT for products list (page={page}, limit={limit}, filters={filter_str})")
            return products_result
        
        self.logger.info(f"Cache MISS for products list, fetching from API")
        products_result = await self.api.get_products(limit=limit, page=page, **filters)
        
        # Cache the products result
        self.cache.set(cache_key, products_result, ttl=180)  # 3 minutes TTL
        
        # Register dependencies
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key="all_products"
        )
        
        if "vendor" in filters:
            self.dependencies.register_dependency(
                key=cache_key,
                depends_on_key=f"vendor:{filters['vendor']}"
            )
        
        if "product_type" in filters:
            self.dependencies.register_dependency(
                key=cache_key,
                depends_on_key=f"product_type:{filters['product_type']}"
            )
        
        return products_result
    
    async def get_order(self, order_id: int) -> Dict[str, Any]:
        """Get an order by ID with caching."""
        cache_key = f"order:{order_id}"
        order = self.cache.get(cache_key)
        
        if order is not None:
            self.logger.info(f"Cache HIT for order {order_id}")
            return order
        
        self.logger.info(f"Cache MISS for order {order_id}, fetching from API")
        order = await self.api.get_order(order_id)
        
        # Cache the order
        self.cache.set(cache_key, order, ttl=300)  # 5 minutes TTL
        
        # Register dependencies
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key=f"customer:{order['customer_id']}"
        )
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key="all_orders"
        )
        
        # Register dependencies on products in the order
        for item in order['items']:
            self.dependencies.register_dependency(
                key=cache_key,
                depends_on_key=f"product:{item['product_id']}"
            )
        
        return order
    
    async def get_orders(self, limit: int = 10, page: int = 1, **filters) -> Dict[str, Any]:
        """Get a list of orders with caching."""
        # Create a cache key that incorporates the filters
        filter_str = "&".join(f"{k}={v}" for k, v in sorted(filters.items()))
        cache_key = f"orders:limit={limit}:page={page}:{filter_str}"
        
        orders_result = self.cache.get(cache_key)
        
        if orders_result is not None:
            self.logger.info(f"Cache HIT for orders list (page={page}, limit={limit}, filters={filter_str})")
            return orders_result
        
        self.logger.info(f"Cache MISS for orders list, fetching from API")
        orders_result = await self.api.get_orders(limit=limit, page=page, **filters)
        
        # Cache the orders result
        self.cache.set(cache_key, orders_result, ttl=180)  # 3 minutes TTL
        
        # Register dependencies
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key="all_orders"
        )
        
        if "customer_id" in filters:
            self.dependencies.register_dependency(
                key=cache_key,
                depends_on_key=f"customer:{filters['customer_id']}"
            )
        
        if "status" in filters:
            self.dependencies.register_dependency(
                key=cache_key,
                depends_on_key=f"order_status:{filters['status']}"
            )
        
        return orders_result
    
    async def get_customer(self, customer_id: int) -> Dict[str, Any]:
        """Get a customer by ID with caching."""
        cache_key = f"customer:{customer_id}"
        customer = self.cache.get(cache_key)
        
        if customer is not None:
            self.logger.info(f"Cache HIT for customer {customer_id}")
            return customer
        
        self.logger.info(f"Cache MISS for customer {customer_id}, fetching from API")
        customer = await self.api.get_customer(customer_id)
        
        # Cache the customer
        self.cache.set(cache_key, customer, ttl=600)  # 10 minutes TTL
        
        # Register dependencies
        self.dependencies.register_dependency(
            key=cache_key,
            depends_on_key="all_customers"
        )
        
        return customer
    
    async def get_customer_orders(self, customer_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get orders for a customer with caching."""
        return await self.get_orders(limit=limit, customer_id=customer_id)
    
    def invalidate_product(self, product_id: int) -> None:
        """Invalidate a product and its dependencies."""
        cache_key = f"product:{product_id}"
        count = self.dependencies.invalidate_with_dependencies(cache_key)
        self.logger.info(f"Invalidated product {product_id} and {count} related cache entries")
    
    def invalidate_order(self, order_id: int) -> None:
        """Invalidate an order and its dependencies."""
        cache_key = f"order:{order_id}"
        count = self.dependencies.invalidate_with_dependencies(cache_key)
        self.logger.info(f"Invalidated order {order_id} and {count} related cache entries")
    
    def invalidate_customer(self, customer_id: int) -> None:
        """Invalidate a customer and its dependencies."""
        cache_key = f"customer:{customer_id}"
        count = self.dependencies.invalidate_with_dependencies(cache_key)
        self.logger.info(f"Invalidated customer {customer_id} and {count} related cache entries")
    
    def invalidate_products_by_type(self, product_type: str) -> None:
        """Invalidate all products of a specific type."""
        cache_key = f"product_type:{product_type}"
        count = self.dependencies.invalidate_with_dependencies(cache_key)
        self.logger.info(f"Invalidated all products with type '{product_type}' and {count} related cache entries")
    
    def invalidate_all_products(self) -> None:
        """Invalidate all product-related cache entries."""
        cache_key = "all_products"
        count = self.dependencies.invalidate_with_dependencies(cache_key)
        self.logger.info(f"Invalidated all products and {count} related cache entries")


async def demonstrate_basic_caching():
    """Demonstrate basic caching functionality."""
    print("\n=== Basic Caching Demonstration ===\n")
    
    # Create cache components
    cache_config = {
        "memory_cache_size": 10000,
        "memory_ttl": 300,  # 5 minutes
        "enable_compression": True,
        "compression_min_size": 1024
    }
    
    # Create cache manager
    cache_factory = CacheFactory("memory", cache_config)
    cache_manager = cache_factory.create_cache_manager()
    
    # Create dependency tracker
    dependency_tracker = CacheDependencyTracker(cache_manager)
    
    # Create API simulator
    api = ShopifyAPISimulator(
        shop_url="https://example.myshopify.com",
        access_token="example_token"
    )
    
    # Create cached client
    client = CachedShopifyClient(api, cache_manager, dependency_tracker)
    
    # Demonstrate caching for product fetches
    print("Fetching product #1 (should be a cache miss)...")
    product1 = await client.get_product(1)
    print(f"Product: {product1['title']}, Price: ${product1['price']}, Inventory: {product1['inventory_quantity']}")
    
    print("\nFetching product #1 again (should be a cache hit)...")
    product1_again = await client.get_product(1)
    print(f"Product: {product1_again['title']}, Price: ${product1_again['price']}, Inventory: {product1_again['inventory_quantity']}")
    
    print("\nFetching product #2 (should be a cache miss)...")
    product2 = await client.get_product(2)
    print(f"Product: {product2['title']}, Price: ${product2['price']}, Inventory: {product2['inventory_quantity']}")
    
    # API stats
    print(f"\nAPI calls made: {api.call_count}")
    print(f"Total API time: {api.call_duration:.2f} seconds")
    
    print("\n=== Basic Caching Demonstration Completed ===\n")


async def demonstrate_optimized_caching(cache_type: str = "memory"):
    """Demonstrate optimized caching functionality with Redis or Memory cache."""
    print(f"\n=== Optimized Caching Demonstration ({cache_type}) ===\n")
    
    # Create cache components
    cache_config = {
        "type": cache_type,
        "memory_cache_size": 10000,
        "redis_ttl": 3600,  # 1 hour for Redis
        "memory_ttl": 300,  # 5 minutes for memory
        "enable_compression": True,
        "compression_min_size": 1024,
        "enable_adaptive_ttl": True,
        "redis": {
            "host": "localhost",
            "port": 6379,
            "db": 0
        }
    }
    
    # Create cache factory
    cache_factory = CacheFactory(cache_type, cache_config)
    
    # Create optimized cache manager with Redis or Memory fallback
    try:
        if cache_type == "redis":
            import redis
            redis_client = redis.Redis(
                host=cache_config["redis"]["host"],
                port=cache_config["redis"]["port"],
                db=cache_config["redis"]["db"],
                socket_timeout=2.0
            )
            cache_manager = cache_factory.create_cache_manager_with_client(redis_client)
            redis_available = True
        else:
            # Use memory cache
            cache_manager = cache_factory.create_memory_cache_manager()
            redis_available = False
    except (ImportError, ConnectionError):
        print("Redis not available, falling back to memory cache")
        cache_manager = cache_factory.create_memory_cache_manager()
        redis_available = False
    
    # Create dependency tracker
    dependency_tracker = CacheDependencyTracker(cache_manager)
    
    # Create metrics collector
    metrics_collector = CacheMetricsCollector(
        cache_manager=cache_manager,
        collection_interval=5,
        enable_periodic_collection=True
    )
    
    # Start metrics collection
    metrics_collector.start_collection()
    
    # Create API simulator
    api = ShopifyAPISimulator(
        shop_url="https://example.myshopify.com",
        access_token="example_token"
    )
    
    # Create cached client
    client = CachedShopifyClient(api, cache_manager, dependency_tracker)
    
    # Demonstration scenario
    print(f"Using {cache_type} cache backend")
    print(f"Redis available: {redis_available}")
    
    # Step 1: Fetch products
    print("\nStep 1: Fetching products (all cache misses)")
    
    # Fetch 5 products individually
    for i in range(1, 6):
        product = await client.get_product(i)
        print(f"  - Product #{i}: {product['title']}, ${product['price']}")
    
    # Fetch a list of products
    products_result = await client.get_products(limit=5, page=1)
    print(f"  - Product List: {len(products_result['products'])} products, {products_result['count']} total")
    
    # Step 2: Fetch the same products again
    print("\nStep 2: Fetching the same products again (should be cache hits)")
    
    for i in range(1, 6):
        product = await client.get_product(i)
        print(f"  - Product #{i}: {product['title']}, ${product['price']}")
    
    products_result = await client.get_products(limit=5, page=1)
    print(f"  - Product List: {len(products_result['products'])} products, {products_result['count']} total")
    
    # Step 3: Fetch orders
    print("\nStep 3: Fetching orders (cache misses)")
    
    # Fetch 3 orders individually
    for i in range(1000, 1003):
        order = await client.get_order(i)
        print(f"  - Order #{order['order_number']}: {len(order['items'])} items, ${order['total_price']:.2f}")
    
    # Fetch a list of orders
    orders_result = await client.get_orders(limit=5, page=1)
    print(f"  - Order List: {len(orders_result['orders'])} orders, {orders_result['count']} total")
    
    # Fetch customer
    customer_id = 1
    customer = await client.get_customer(customer_id)
    print(f"  - Customer: {customer['first_name']} {customer['last_name']}, {customer['email']}")
    
    # Fetch customer orders
    customer_orders = await client.get_customer_orders(customer_id, limit=5)
    print(f"  - Customer Orders: {len(customer_orders['orders'])} orders")
    
    # Step 4: Invalidate a product and its dependencies
    print("\nStep 4: Invalidating product #3 and its dependencies")
    client.invalidate_product(3)
    
    # Fetch product #3 again (should be a cache miss)
    product3 = await client.get_product(3)
    print(f"  - Product #3 (after invalidation): {product3['title']}, ${product3['price']}")
    
    # Step 5: Invalidate all products of a specific type
    product_type = "Type 1"
    print(f"\nStep 5: Invalidating all products of type '{product_type}'")
    client.invalidate_products_by_type(product_type)
    
    # Fetch a list of products again (should be a cache miss since we invalidated some products)
    products_result = await client.get_products(limit=5, page=1)
    print(f"  - Product List (after invalidation): {len(products_result['products'])} products")
    
    # Step 6: Fetch some additional data
    print("\nStep 6: Fetching additional data to generate more metrics")
    
    # Fetch products with filters
    filtered_products = await client.get_products(limit=5, vendor="Vendor 1")
    print(f"  - Filtered Products (Vendor 1): {len(filtered_products['products'])} products")
    
    # Fetch orders with filters
    filtered_orders = await client.get_orders(limit=5, status="paid")
    print(f"  - Filtered Orders (paid): {len(filtered_orders['orders'])} orders")
    
    # Wait for metrics collection
    print("\nWaiting for metrics collection...")
    await asyncio.sleep(5)
    
    # Display cache metrics
    metrics = metrics_collector.get_aggregated_metrics(60)
    
    print("\nCache Metrics:")
    print(f"  - Hit Rate: {metrics.get('hit_rate', {}).get('avg', 0) * 100:.1f}%")
    print(f"  - Miss Rate: {metrics.get('miss_rate', {}).get('avg', 0) * 100:.1f}%")
    print(f"  - Average TTL: {metrics.get('average_ttl', {}).get('avg', 0):.0f} seconds")
    print(f"  - Memory Usage: {metrics.get('memory_usage', {}).get('avg', 0) / 1024:.2f} KB")
    print(f"  - Operations per second: {metrics.get('ops_per_second', {}).get('avg', 0):.2f}")
    
    # API stats
    print(f"\nAPI calls made: {api.call_count}")
    print(f"Total API time: {api.call_duration:.2f} seconds")
    
    # Stop metrics collection
    metrics_collector.stop_collection()
    
    # Clean up (for Redis)
    await cache_manager.shutdown()
    
    print(f"\n=== Optimized Caching Demonstration ({cache_type}) Completed ===\n")


async def demonstrate_cache_with_webapp():
    """Demonstrate a realistic web application scenario with caching."""
    print("\n=== Web Application with Caching Demonstration ===\n")
    
    # Create cache system using factory
    cache_config = {
        "type": "memory",
        "memory_cache_size": 10000,
        "memory_ttl": 300,
        "enable_compression": True,
        "compression_min_size": 1024,
        "enable_adaptive_ttl": True,
        "enable_dependency_tracking": True
    }
    
    cache_system = CacheFactory.create_full_cache_system(cache_config)
    cache_manager = cache_system["cache_manager"]
    dependency_tracker = cache_system["dependency_tracker"]
    metrics_collector = cache_system["metrics_collector"]
    
    # Start metrics collection
    metrics_collector.start_collection()
    
    # Create API simulator
    api = ShopifyAPISimulator(
        shop_url="https://example.myshopify.com",
        access_token="example_token"
    )
    
    # Create cached client
    client = CachedShopifyClient(api, cache_manager, dependency_tracker)
    
    # Simulate a web application serving various pages
    print("Simulating a web application with multiple users and page views")
    
    async def simulate_user_session(user_id: int, page_views: int):
        """Simulate a user browsing the website."""
        logger.info(f"User {user_id} started a session with {page_views} page views")
        
        for i in range(page_views):
            # Randomly choose what page to view
            page_type = random.choice([
                "home", "product", "category", "cart", "checkout", 
                "order_history", "account"
            ])
            
            if page_type == "home":
                # Home page shows featured products
                await client.get_products(limit=5, page=1)
                logger.info(f"User {user_id} viewed the home page")
            
            elif page_type == "product":
                # Product details page
                product_id = random.randint(1, 200)
                await client.get_product(product_id)
                logger.info(f"User {user_id} viewed product #{product_id}")
            
            elif page_type == "category":
                # Category page shows filtered products
                product_type = f"Type {random.randint(1, 5)}"
                await client.get_products(limit=10, page=1, product_type=product_type)
                logger.info(f"User {user_id} viewed category '{product_type}'")
            
            elif page_type == "cart":
                # Cart page - might check product availability
                for _ in range(random.randint(1, 3)):
                    product_id = random.randint(1, 200)
                    await client.get_product(product_id)
                logger.info(f"User {user_id} viewed their cart")
            
            elif page_type == "checkout":
                # Checkout page - should always get fresh product data
                # Invalidate cache for the products being purchased
                for _ in range(random.randint(1, 3)):
                    product_id = random.randint(1, 200)
                    client.invalidate_product(product_id)
                    await client.get_product(product_id)
                logger.info(f"User {user_id} started checkout")
            
            elif page_type == "order_history":
                # Order history page
                customer_id = (user_id % 20) + 1
                await client.get_customer(customer_id)
                await client.get_customer_orders(customer_id, limit=5)
                logger.info(f"User {user_id} viewed order history")
            
            elif page_type == "account":
                # Account page
                customer_id = (user_id % 20) + 1
                await client.get_customer(customer_id)
                logger.info(f"User {user_id} viewed account page")
            
            # Add a small delay between page views
            await asyncio.sleep(random.uniform(0.1, 0.5))
    
    # Simulate multiple concurrent users
    user_tasks = []
    for user_id in range(1, 11):  # 10 users
        page_views = random.randint(5, 15)  # Each user views 5-15 pages
        user_tasks.append(simulate_user_session(user_id, page_views))
    
    # Simulate admin actions in parallel
    async def simulate_admin_actions():
        """Simulate an admin making inventory updates."""
        logger.info("Admin started inventory updates")
        
        await asyncio.sleep(1)  # Wait a bit before starting
        
        # Simulate 5 inventory updates
        for i in range(5):
            product_id = random.randint(1, 200)
            client.invalidate_product(product_id)
            logger.info(f"Admin updated inventory for product #{product_id}")
            await asyncio.sleep(0.5)
        
        # Simulate a product type update
        product_type = f"Type {random.randint(1, 5)}"
        client.invalidate_products_by_type(product_type)
        logger.info(f"Admin updated all products of type '{product_type}'")
    
    # Run all user sessions and admin actions concurrently
    tasks = user_tasks + [simulate_admin_actions()]
    await asyncio.gather(*tasks)
    
    # Wait for metrics collection
    await asyncio.sleep(5)
    
    # Display results
    metrics = metrics_collector.get_aggregated_metrics(60)
    
    print("\nWeb Application Performance Results:")
    print(f"Total API calls: {api.call_count}")
    print(f"Total API time: {api.call_duration:.2f} seconds")
    print(f"Cache hit rate: {metrics.get('hit_rate', {}).get('avg', 0) * 100:.1f}%")
    print(f"Cache operations: {metrics.get('total_operations', {}).get('sum', 0)}")
    print(f"Average get operation time: {metrics.get('get_time', {}).get('avg', 0) * 1000:.2f} ms")
    
    # Calculate API call savings
    total_requests = metrics.get('get_count', {}).get('sum', 0)
    hits = metrics.get('hit_count', {}).get('sum', 0)
    
    print(f"\nWith caching, served {total_requests} requests with only {api.call_count} API calls")
    print(f"API call savings: {hits} calls ({hits / total_requests * 100:.1f}% of requests)")
    
    time_savings = hits * 0.2  # Assuming 0.2s average API call time
    print(f"Estimated time savings: {time_savings:.2f} seconds")
    
    # If we have a high number of requests, calculate theoretical throughput improvement
    if total_requests > 50:
        without_cache_time = total_requests * 0.2  # Assuming 0.2s per API call
        with_cache_time = api.call_duration + (total_requests - hits) * 0.001  # Assuming 1ms cache lookup
        throughput_improvement = without_cache_time / with_cache_time
        
        print(f"\nTheoretical throughput improvement: {throughput_improvement:.1f}x")
        print(f"Without cache: {without_cache_time:.2f}s total processing time")
        print(f"With cache: {with_cache_time:.2f}s total processing time")
    
    # Stop metrics collection
    metrics_collector.stop_collection()
    
    # Clean up resources
    cache_manager.shutdown()
    
    print("\n=== Web Application Demonstration Completed ===\n")


async def main():
    """Main function to run the example."""
    print("Shopify MCP Server - Optimized Cache Usage Example")
    
    # Demonstrate basic caching functionality
    await demonstrate_basic_caching()
    
    # Demonstrate optimized memory caching
    await demonstrate_optimized_caching(cache_type="memory")
    
    # Demonstrate optimized Redis caching if available
    try:
        import redis
        print("Redis is available, demonstrating Redis caching...")
        try:
            redis_client = redis.Redis(host="localhost", port=6379, db=0, socket_timeout=2.0)
            redis_client.ping()  # Check if Redis is running
            await demonstrate_optimized_caching(cache_type="redis")
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
            print("Redis server not running, skipping Redis cache demonstration")
    except ImportError:
        print("Redis package not installed, skipping Redis cache demonstration")
    
    # Demonstrate a realistic web application scenario with caching
    await demonstrate_cache_with_webapp()
    
    print("\nOptimized cache example completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())