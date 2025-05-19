"""
Rakuten Integration Demonstration
Shows how to use the Rakuten API integration with Shopify MCP Server
"""

import asyncio
import logging
from datetime import datetime, timedelta
import os
from typing import Dict, Any

from src.api.abstract import PlatformType, platform_manager
from src.api.rakuten import RakutenAPIClient
from src.api.shopify.optimized_client import OptimizedShopifyGraphQL
from src.sync.rakuten_sync import RakutenSync, SyncConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def demo_basic_rakuten_client():
    """Demonstrate basic Rakuten API client usage"""
    logger.info("=== Basic Rakuten Client Demo ===")
    
    # Initialize Rakuten client
    credentials = {
        'service_secret': os.getenv('RAKUTEN_SERVICE_SECRET'),
        'license_key': os.getenv('RAKUTEN_LICENSE_KEY'),
        'shop_id': os.getenv('RAKUTEN_SHOP_ID'),
        'test_mode': True
    }
    
    client = RakutenAPIClient(credentials)
    
    try:
        # Authenticate
        logger.info("Authenticating with Rakuten...")
        if await client.authenticate():
            logger.info("Authentication successful!")
        else:
            logger.error("Authentication failed")
            return
        
        # Check connection
        if await client.check_connection():
            logger.info("Connection verified")
        
        # Get products
        logger.info("\n--- Getting Products ---")
        products = await client.get_products(limit=5)
        logger.info(f"Found {len(products)} products")
        
        for product in products[:3]:
            logger.info(f"Product: {product['title']} (ID: {product['platform_id']})")
            logger.info(f"  Price: ¥{product['price']}")
            logger.info(f"  Status: {product['status']}")
            logger.info(f"  Inventory: {product.get('inventory_quantity', 'N/A')}")
        
        # Get orders
        logger.info("\n--- Getting Orders ---")
        orders = await client.get_orders(limit=5)
        logger.info(f"Found {len(orders)} orders")
        
        for order in orders[:3]:
            logger.info(f"Order: {order['order_number']}")
            logger.info(f"  Status: {order['status']}")
            logger.info(f"  Total: ¥{order['total']}")
            logger.info(f"  Customer: {order.get('email', 'N/A')}")
        
        # Get customers
        logger.info("\n--- Getting Customers ---")
        customers = await client.get_customers(limit=5)
        logger.info(f"Found {len(customers)} customers")
        
        for customer in customers[:3]:
            logger.info(f"Customer: {customer.get('email', 'N/A')}")
            logger.info(f"  Name: {customer.get('first_name', '')} {customer.get('last_name', '')}")
            logger.info(f"  Member ID: {customer['platform_id']}")
        
        # Check rate limits
        logger.info("\n--- Rate Limit Status ---")
        rate_limit = client.get_rate_limit_info()
        logger.info(f"Requests remaining: {rate_limit.requests_remaining}/{rate_limit.requests_limit}")
        logger.info(f"Usage: {rate_limit.usage_percentage:.1%}")
        
        # Platform capabilities
        logger.info("\n--- Platform Capabilities ---")
        capabilities = client.get_platform_capabilities()
        for capability, supported in capabilities.items():
            logger.info(f"{capability}: {'✓' if supported else '✗'}")
        
    finally:
        await client.close()


async def demo_multi_platform_management():
    """Demonstrate multi-platform management"""
    logger.info("\n=== Multi-Platform Management Demo ===")
    
    # Register platform clients
    platform_manager.register_platform(PlatformType.SHOPIFY, OptimizedShopifyGraphQL)
    platform_manager.register_platform(PlatformType.RAKUTEN, RakutenAPIClient)
    
    # Initialize Shopify
    shopify_credentials = {
        'shop_url': os.getenv('SHOPIFY_SHOP_URL'),
        'access_token': os.getenv('SHOPIFY_ACCESS_TOKEN')
    }
    
    if await platform_manager.initialize_platform(PlatformType.SHOPIFY, shopify_credentials):
        logger.info("Shopify platform initialized")
    
    # Initialize Rakuten
    rakuten_credentials = {
        'service_secret': os.getenv('RAKUTEN_SERVICE_SECRET'),
        'license_key': os.getenv('RAKUTEN_LICENSE_KEY'),
        'shop_id': os.getenv('RAKUTEN_SHOP_ID')
    }
    
    if await platform_manager.initialize_platform(PlatformType.RAKUTEN, rakuten_credentials):
        logger.info("Rakuten platform initialized")
    
    # Check all connections
    logger.info("\n--- Connection Status ---")
    connections = await platform_manager.check_all_connections()
    for platform, status in connections.items():
        logger.info(f"{platform.value}: {'Connected' if status else 'Disconnected'}")
    
    # Get active platforms
    active = platform_manager.get_active_platforms()
    logger.info(f"\nActive platforms: {[p.value for p in active]}")
    
    # Compare product across platforms
    logger.info("\n--- Cross-Platform Product Comparison ---")
    product_id = "test-sku-001"  # Assuming same SKU across platforms
    
    products = await platform_manager.get_product_from_all(product_id)
    for platform, product in products.items():
        if product:
            logger.info(f"\n{platform.value}:")
            logger.info(f"  Title: {product.get('title', 'N/A')}")
            logger.info(f"  Price: {product.get('price', 'N/A')}")
            logger.info(f"  Inventory: {product.get('inventory_quantity', 'N/A')}")
        else:
            logger.info(f"\n{platform.value}: Product not found")
    
    # Get platform capabilities
    logger.info("\n--- Platform Capabilities Comparison ---")
    all_capabilities = platform_manager.get_platform_capabilities()
    
    # Create comparison table
    features = set()
    for caps in all_capabilities.values():
        features.update(caps.keys())
    
    for feature in sorted(features):
        logger.info(f"\n{feature}:")
        for platform, caps in all_capabilities.items():
            supported = caps.get(feature, False)
            logger.info(f"  {platform.value}: {'✓' if supported else '✗'}")


async def demo_synchronization():
    """Demonstrate synchronization between platforms"""
    logger.info("\n=== Synchronization Demo ===")
    
    # Configure sync
    sync_config = SyncConfig(
        batch_size=10,
        sync_interval=300,  # 5 minutes
        sync_products=True,
        sync_inventory=True,
        sync_orders=True,
        sync_direction='bidirectional',
        conflict_resolution='newest'
    )
    
    sync_manager = RakutenSync(sync_config)
    
    # Initialize platforms
    shopify_credentials = {
        'shop_url': os.getenv('SHOPIFY_SHOP_URL'),
        'access_token': os.getenv('SHOPIFY_ACCESS_TOKEN')
    }
    
    rakuten_credentials = {
        'service_secret': os.getenv('RAKUTEN_SERVICE_SECRET'),
        'license_key': os.getenv('RAKUTEN_LICENSE_KEY'),
        'shop_id': os.getenv('RAKUTEN_SHOP_ID')
    }
    
    if await sync_manager.initialize(shopify_credentials, rakuten_credentials):
        logger.info("Sync manager initialized")
    else:
        logger.error("Failed to initialize sync manager")
        return
    
    # Perform one-time sync
    logger.info("\n--- Product Sync ---")
    product_result = await sync_manager.sync_products()
    logger.info(f"Products synced: {product_result.synced_count}")
    logger.info(f"Failed: {product_result.failed_count}")
    logger.info(f"Skipped: {product_result.skipped_count}")
    if product_result.errors:
        logger.error(f"Errors: {product_result.errors}")
    
    logger.info("\n--- Inventory Sync ---")
    inventory_result = await sync_manager.sync_inventory()
    logger.info(f"Inventory items synced: {inventory_result.synced_count}")
    logger.info(f"Failed: {inventory_result.failed_count}")
    
    logger.info("\n--- Order Sync ---")
    order_result = await sync_manager.sync_orders()
    logger.info(f"Orders synced: {order_result.synced_count}")
    logger.info(f"Failed: {order_result.failed_count}")
    
    # Show sync history
    logger.info("\n--- Sync History ---")
    for i, result in enumerate(sync_manager.sync_history[-5:], 1):
        logger.info(f"Sync {i}:")
        logger.info(f"  Success: {result.success}")
        logger.info(f"  Duration: {result.duration:.2f}s")
        logger.info(f"  Synced: {result.synced_count}")
        logger.info(f"  Failed: {result.failed_count}")


async def demo_continuous_sync():
    """Demonstrate continuous synchronization"""
    logger.info("\n=== Continuous Sync Demo ===")
    
    # Configure for frequent syncs (demo purposes)
    sync_config = SyncConfig(
        batch_size=5,
        sync_interval=60,  # 1 minute for demo
        sync_products=True,
        sync_inventory=True,
        sync_orders=False,  # Skip orders for demo
        sync_direction='bidirectional'
    )
    
    sync_manager = RakutenSync(sync_config)
    
    # Initialize platforms
    shopify_credentials = {
        'shop_url': os.getenv('SHOPIFY_SHOP_URL'),
        'access_token': os.getenv('SHOPIFY_ACCESS_TOKEN')
    }
    
    rakuten_credentials = {
        'service_secret': os.getenv('RAKUTEN_SERVICE_SECRET'),
        'license_key': os.getenv('RAKUTEN_LICENSE_KEY'),
        'shop_id': os.getenv('RAKUTEN_SHOP_ID')
    }
    
    if not await sync_manager.initialize(shopify_credentials, rakuten_credentials):
        logger.error("Failed to initialize sync manager")
        return
    
    # Start continuous sync
    logger.info("Starting continuous sync...")
    await sync_manager.start_sync()
    
    # Let it run for a few cycles
    logger.info("Sync running... (will stop in 3 minutes)")
    await asyncio.sleep(180)  # 3 minutes
    
    # Stop sync
    await sync_manager.stop_sync()
    logger.info("Continuous sync stopped")
    
    # Show final stats
    logger.info("\n--- Final Sync Statistics ---")
    total_synced = sum(r.synced_count for r in sync_manager.sync_history)
    total_failed = sum(r.failed_count for r in sync_manager.sync_history)
    total_duration = sum(r.duration for r in sync_manager.sync_history)
    
    logger.info(f"Total syncs performed: {len(sync_manager.sync_history)}")
    logger.info(f"Total items synced: {total_synced}")
    logger.info(f"Total failures: {total_failed}")
    logger.info(f"Average sync duration: {total_duration/len(sync_manager.sync_history):.2f}s")


async def main():
    """Run all demonstrations"""
    try:
        # Basic client demo
        await demo_basic_rakuten_client()
        
        # Multi-platform management
        await demo_multi_platform_management()
        
        # Synchronization
        await demo_synchronization()
        
        # Continuous sync (optional - takes 3 minutes)
        # await demo_continuous_sync()
        
    except Exception as e:
        logger.error(f"Demo error: {e}", exc_info=True)


if __name__ == "__main__":
    # Run the demo
    asyncio.run(main())