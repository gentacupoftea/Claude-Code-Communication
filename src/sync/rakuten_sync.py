"""
Rakuten Synchronization Module
Handles data synchronization between Shopify and Rakuten
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from ..api.abstract.platform_manager import platform_manager, PlatformType
from ..api.shopify.optimized_client import OptimizedShopifyGraphQL
from ..api.rakuten.client import RakutenAPIClient

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    synced_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    errors: List[str] = None
    duration: float = 0
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


@dataclass
class SyncConfig:
    """Configuration for sync operations"""
    batch_size: int = 50
    sync_interval: int = 300  # seconds
    retry_attempts: int = 3
    retry_delay: int = 5
    
    # Sync direction
    sync_products: bool = True
    sync_inventory: bool = True
    sync_orders: bool = True
    sync_customers: bool = False  # Privacy concerns
    
    # Direction: shopify_to_rakuten, rakuten_to_shopify, bidirectional
    sync_direction: str = "bidirectional"
    
    # Conflict resolution: newest, shopify_priority, rakuten_priority
    conflict_resolution: str = "newest"


class RakutenSync:
    """
    Manages synchronization between Shopify and Rakuten
    """
    
    def __init__(self, config: SyncConfig = None):
        """
        Initialize sync manager
        
        Args:
            config: Sync configuration
        """
        self.config = config or SyncConfig()
        self.logger = logger
        self.is_running = False
        self.sync_task: Optional[asyncio.Task] = None
        
        # Sync state tracking
        self.last_sync_time: Dict[str, datetime] = {}
        self.sync_history: List[SyncResult] = []
        
    async def initialize(self, 
                        shopify_credentials: Dict[str, Any],
                        rakuten_credentials: Dict[str, Any]) -> bool:
        """
        Initialize platform connections
        
        Args:
            shopify_credentials: Shopify API credentials
            rakuten_credentials: Rakuten API credentials
            
        Returns:
            True if both platforms initialized successfully
        """
        try:
            # Initialize Shopify
            shopify_client = OptimizedShopifyGraphQL(
                shop_url=shopify_credentials['shop_url'],
                access_token=shopify_credentials['access_token']
            )
            await shopify_client.start()
            platform_manager.register_platform(PlatformType.SHOPIFY, type(shopify_client))
            await platform_manager.initialize_platform(PlatformType.SHOPIFY, shopify_credentials)
            
            # Initialize Rakuten
            rakuten_client = RakutenAPIClient(rakuten_credentials)
            platform_manager.register_platform(PlatformType.RAKUTEN, RakutenAPIClient)
            await platform_manager.initialize_platform(PlatformType.RAKUTEN, rakuten_credentials)
            
            # Check connections
            connections = await platform_manager.check_all_connections()
            
            return all(connections.values())
            
        except Exception as e:
            self.logger.error(f"Failed to initialize platforms: {e}")
            return False
            
    async def start_sync(self):
        """Start continuous synchronization"""
        if self.is_running:
            self.logger.warning("Sync already running")
            return
            
        self.is_running = True
        self.sync_task = asyncio.create_task(self._sync_loop())
        self.logger.info("Started synchronization")
        
    async def stop_sync(self):
        """Stop synchronization"""
        self.is_running = False
        
        if self.sync_task:
            self.sync_task.cancel()
            try:
                await self.sync_task
            except asyncio.CancelledError:
                pass
                
        self.logger.info("Stopped synchronization")
        
    async def _sync_loop(self):
        """Main synchronization loop"""
        while self.is_running:
            try:
                start_time = datetime.now()
                
                # Perform sync operations
                results = []
                
                if self.config.sync_products:
                    result = await self.sync_products()
                    results.append(result)
                    
                if self.config.sync_inventory:
                    result = await self.sync_inventory()
                    results.append(result)
                    
                if self.config.sync_orders:
                    result = await self.sync_orders()
                    results.append(result)
                    
                if self.config.sync_customers:
                    result = await self.sync_customers()
                    results.append(result)
                    
                # Log results
                for result in results:
                    if result.errors:
                        self.logger.error(f"Sync errors: {result.errors}")
                        
                # Wait for next sync
                await asyncio.sleep(self.config.sync_interval)
                
            except Exception as e:
                self.logger.error(f"Error in sync loop: {e}")
                await asyncio.sleep(self.config.retry_delay)
                
    async def sync_products(self) -> SyncResult:
        """Sync products between platforms"""
        result = SyncResult(success=True)
        start_time = datetime.now()
        
        try:
            if self.config.sync_direction in ['shopify_to_rakuten', 'bidirectional']:
                # Sync from Shopify to Rakuten
                shopify_result = await self._sync_products_from_shopify()
                result.synced_count += shopify_result.synced_count
                result.failed_count += shopify_result.failed_count
                result.errors.extend(shopify_result.errors)
                
            if self.config.sync_direction in ['rakuten_to_shopify', 'bidirectional']:
                # Sync from Rakuten to Shopify
                rakuten_result = await self._sync_products_from_rakuten()
                result.synced_count += rakuten_result.synced_count
                result.failed_count += rakuten_result.failed_count
                result.errors.extend(rakuten_result.errors)
                
            # Update last sync time
            self.last_sync_time['products'] = datetime.now()
            
        except Exception as e:
            self.logger.error(f"Product sync failed: {e}")
            result.success = False
            result.errors.append(str(e))
            
        result.duration = (datetime.now() - start_time).total_seconds()
        self.sync_history.append(result)
        
        return result
        
    async def _sync_products_from_shopify(self) -> SyncResult:
        """Sync products from Shopify to Rakuten"""
        result = SyncResult(success=True)
        
        try:
            shopify_client = platform_manager.get_platform(PlatformType.SHOPIFY)
            rakuten_client = platform_manager.get_platform(PlatformType.RAKUTEN)
            
            if not shopify_client or not rakuten_client:
                raise ValueError("Platform clients not initialized")
                
            # Get products from Shopify
            offset = 0
            
            while True:
                products = await shopify_client.get_products(
                    limit=self.config.batch_size,
                    offset=offset
                )
                
                if not products:
                    break
                    
                # Sync each product
                for product in products:
                    try:
                        # Check if product exists in Rakuten
                        existing = await self._find_rakuten_product_by_sku(
                            rakuten_client,
                            product.get('sku')
                        )
                        
                        if existing:
                            # Update existing product
                            if self._should_update_product(product, existing):
                                await rakuten_client.update_product(
                                    existing['platform_id'],
                                    product
                                )
                                result.synced_count += 1
                            else:
                                result.skipped_count += 1
                        else:
                            # Create new product
                            await rakuten_client.create_product(product)
                            result.synced_count += 1
                            
                    except Exception as e:
                        self.logger.error(f"Failed to sync product {product.get('platform_id')}: {e}")
                        result.failed_count += 1
                        result.errors.append(str(e))
                        
                offset += self.config.batch_size
                
                # Rate limiting
                await asyncio.sleep(1)
                
        except Exception as e:
            self.logger.error(f"Shopify to Rakuten sync failed: {e}")
            result.success = False
            result.errors.append(str(e))
            
        return result
        
    async def _sync_products_from_rakuten(self) -> SyncResult:
        """Sync products from Rakuten to Shopify"""
        result = SyncResult(success=True)
        
        try:
            shopify_client = platform_manager.get_platform(PlatformType.SHOPIFY)
            rakuten_client = platform_manager.get_platform(PlatformType.RAKUTEN)
            
            if not shopify_client or not rakuten_client:
                raise ValueError("Platform clients not initialized")
                
            # Get products from Rakuten
            offset = 0
            
            while True:
                products = await rakuten_client.get_products(
                    limit=self.config.batch_size,
                    offset=offset
                )
                
                if not products:
                    break
                    
                # Sync each product
                for product in products:
                    try:
                        # Check if product exists in Shopify
                        existing = await self._find_shopify_product_by_sku(
                            shopify_client,
                            product.get('sku')
                        )
                        
                        if existing:
                            # Update existing product
                            if self._should_update_product(product, existing):
                                await shopify_client.update_product(
                                    existing['platform_id'],
                                    product
                                )
                                result.synced_count += 1
                            else:
                                result.skipped_count += 1
                        else:
                            # Create new product
                            await shopify_client.create_product(product)
                            result.synced_count += 1
                            
                    except Exception as e:
                        self.logger.error(f"Failed to sync product {product.get('platform_id')}: {e}")
                        result.failed_count += 1
                        result.errors.append(str(e))
                        
                offset += self.config.batch_size
                
                # Rate limiting
                await asyncio.sleep(1)
                
        except Exception as e:
            self.logger.error(f"Rakuten to Shopify sync failed: {e}")
            result.success = False
            result.errors.append(str(e))
            
        return result
        
    async def sync_inventory(self) -> SyncResult:
        """Sync inventory levels between platforms"""
        result = SyncResult(success=True)
        start_time = datetime.now()
        
        try:
            # Get all products with inventory tracking
            shopify_products = await self._get_all_products(PlatformType.SHOPIFY)
            rakuten_products = await self._get_all_products(PlatformType.RAKUTEN)
            
            # Map products by SKU
            shopify_by_sku = {p['sku']: p for p in shopify_products if p.get('sku')}
            rakuten_by_sku = {p['sku']: p for p in rakuten_products if p.get('sku')}
            
            # Find common SKUs
            common_skus = set(shopify_by_sku.keys()) & set(rakuten_by_sku.keys())
            
            for sku in common_skus:
                try:
                    shopify_product = shopify_by_sku[sku]
                    rakuten_product = rakuten_by_sku[sku]
                    
                    shopify_qty = shopify_product.get('inventory_quantity', 0)
                    rakuten_qty = rakuten_product.get('inventory_quantity', 0)
                    
                    if shopify_qty != rakuten_qty:
                        # Resolve conflict based on configuration
                        if self.config.conflict_resolution == 'newest':
                            # Use the most recently updated
                            shopify_updated = datetime.fromisoformat(shopify_product.get('updated_at', ''))
                            rakuten_updated = datetime.fromisoformat(rakuten_product.get('updated_at', ''))
                            
                            if shopify_updated > rakuten_updated:
                                final_qty = shopify_qty
                            else:
                                final_qty = rakuten_qty
                        elif self.config.conflict_resolution == 'shopify_priority':
                            final_qty = shopify_qty
                        else:  # rakuten_priority
                            final_qty = rakuten_qty
                            
                        # Update both platforms
                        await platform_manager.sync_inventory_across_platforms(
                            sku,
                            final_qty
                        )
                        
                        result.synced_count += 1
                        
                except Exception as e:
                    self.logger.error(f"Failed to sync inventory for SKU {sku}: {e}")
                    result.failed_count += 1
                    result.errors.append(str(e))
                    
            # Update last sync time
            self.last_sync_time['inventory'] = datetime.now()
            
        except Exception as e:
            self.logger.error(f"Inventory sync failed: {e}")
            result.success = False
            result.errors.append(str(e))
            
        result.duration = (datetime.now() - start_time).total_seconds()
        self.sync_history.append(result)
        
        return result
        
    async def sync_orders(self) -> SyncResult:
        """Sync orders between platforms"""
        result = SyncResult(success=True)
        start_time = datetime.now()
        
        try:
            # Only sync orders created/updated since last sync
            last_sync = self.last_sync_time.get('orders', datetime.now() - timedelta(days=1))
            
            if self.config.sync_direction in ['shopify_to_rakuten', 'bidirectional']:
                # Sync new Shopify orders to Rakuten
                shopify_orders = await self._get_recent_orders(
                    PlatformType.SHOPIFY,
                    last_sync
                )
                
                for order in shopify_orders:
                    try:
                        # Check if order needs to be synced
                        if self._should_sync_order(order):
                            # Create order in Rakuten
                            await self._create_rakuten_order(order)
                            result.synced_count += 1
                            
                    except Exception as e:
                        self.logger.error(f"Failed to sync order {order.get('order_number')}: {e}")
                        result.failed_count += 1
                        result.errors.append(str(e))
                        
            if self.config.sync_direction in ['rakuten_to_shopify', 'bidirectional']:
                # Sync new Rakuten orders to Shopify
                rakuten_orders = await self._get_recent_orders(
                    PlatformType.RAKUTEN,
                    last_sync
                )
                
                for order in rakuten_orders:
                    try:
                        # Check if order needs to be synced
                        if self._should_sync_order(order):
                            # Create order in Shopify
                            await self._create_shopify_order(order)
                            result.synced_count += 1
                            
                    except Exception as e:
                        self.logger.error(f"Failed to sync order {order.get('order_number')}: {e}")
                        result.failed_count += 1
                        result.errors.append(str(e))
                        
            # Update last sync time
            self.last_sync_time['orders'] = datetime.now()
            
        except Exception as e:
            self.logger.error(f"Order sync failed: {e}")
            result.success = False
            result.errors.append(str(e))
            
        result.duration = (datetime.now() - start_time).total_seconds()
        self.sync_history.append(result)
        
        return result
        
    async def sync_customers(self) -> SyncResult:
        """Sync customer data between platforms"""
        result = SyncResult(success=True)
        start_time = datetime.now()
        
        # Note: Customer sync should be carefully implemented
        # considering privacy laws and data protection
        
        self.logger.warning("Customer sync not implemented due to privacy concerns")
        result.skipped_count = 1
        
        result.duration = (datetime.now() - start_time).total_seconds()
        self.sync_history.append(result)
        
        return result
        
    # Helper methods
    
    async def _find_rakuten_product_by_sku(self, client, sku: str) -> Optional[Dict[str, Any]]:
        """Find Rakuten product by SKU"""
        if not sku:
            return None
            
        try:
            # Search for product by SKU
            products = await client.get_products(filters={'sku': sku})
            return products[0] if products else None
        except Exception as e:
            self.logger.error(f"Error finding Rakuten product by SKU {sku}: {e}")
            return None
            
    async def _find_shopify_product_by_sku(self, client, sku: str) -> Optional[Dict[str, Any]]:
        """Find Shopify product by SKU"""
        if not sku:
            return None
            
        try:
            # Search for product by SKU
            products = await client.get_products(filters={'sku': sku})
            return products[0] if products else None
        except Exception as e:
            self.logger.error(f"Error finding Shopify product by SKU {sku}: {e}")
            return None
            
    def _should_update_product(self, source: Dict[str, Any], target: Dict[str, Any]) -> bool:
        """Determine if product should be updated"""
        # Compare key fields
        fields_to_compare = ['title', 'description', 'price', 'inventory_quantity']
        
        for field in fields_to_compare:
            if source.get(field) != target.get(field):
                return True
                
        # Compare timestamps if conflict resolution is 'newest'
        if self.config.conflict_resolution == 'newest':
            source_updated = datetime.fromisoformat(source.get('updated_at', ''))
            target_updated = datetime.fromisoformat(target.get('updated_at', ''))
            return source_updated > target_updated
            
        return False
        
    async def _get_all_products(self, platform: PlatformType) -> List[Dict[str, Any]]:
        """Get all products from a platform"""
        client = platform_manager.get_platform(platform)
        if not client:
            return []
            
        products = []
        offset = 0
        
        while True:
            batch = await client.get_products(
                limit=self.config.batch_size,
                offset=offset
            )
            
            if not batch:
                break
                
            products.extend(batch)
            offset += self.config.batch_size
            
            # Rate limiting
            await asyncio.sleep(0.5)
            
        return products
        
    async def _get_recent_orders(self, platform: PlatformType, since: datetime) -> List[Dict[str, Any]]:
        """Get orders created/updated since a specific time"""
        client = platform_manager.get_platform(platform)
        if not client:
            return []
            
        orders = []
        offset = 0
        
        while True:
            batch = await client.get_orders(
                limit=self.config.batch_size,
                offset=offset,
                filters={'created_after': since.isoformat()}
            )
            
            if not batch:
                break
                
            orders.extend(batch)
            offset += self.config.batch_size
            
            # Rate limiting
            await asyncio.sleep(0.5)
            
        return orders
        
    def _should_sync_order(self, order: Dict[str, Any]) -> bool:
        """Determine if order should be synced"""
        # Don't sync cancelled or refunded orders
        if order.get('status') in ['cancelled', 'refunded']:
            return False
            
        # Don't sync test orders
        if order.get('test', False):
            return False
            
        return True
        
    async def _create_rakuten_order(self, shopify_order: Dict[str, Any]):
        """Create order in Rakuten from Shopify order"""
        # This would need to handle the complexity of order creation
        # including customer matching, product mapping, etc.
        self.logger.warning("Order creation in Rakuten not implemented")
        
    async def _create_shopify_order(self, rakuten_order: Dict[str, Any]):
        """Create order in Shopify from Rakuten order"""
        # This would need to handle the complexity of order creation
        # including customer matching, product mapping, etc.
        self.logger.warning("Order creation in Shopify not implemented")


# Scheduler for automated sync
class SyncScheduler:
    """
    Schedules and manages sync tasks
    """
    
    def __init__(self, sync_manager: RakutenSync):
        """
        Initialize scheduler
        
        Args:
            sync_manager: RakutenSync instance
        """
        self.sync_manager = sync_manager
        self.scheduler_task: Optional[asyncio.Task] = None
        self.is_running = False
        
    async def start(self):
        """Start the scheduler"""
        if self.is_running:
            return
            
        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._run_scheduler())
        
    async def stop(self):
        """Stop the scheduler"""
        self.is_running = False
        
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
                
    async def _run_scheduler(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                # Run sync
                await self.sync_manager.start_sync()
                
                # Wait for next interval
                await asyncio.sleep(self.sync_manager.config.sync_interval)
                
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)  # Wait before retry