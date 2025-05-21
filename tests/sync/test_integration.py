"""
Integration tests for Shopify Sync Engine.

These tests verify the integration of the ShopifySyncEngine with external platform APIs
and the proper handling of data synchronization between platforms.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import time
from datetime import datetime

from src.sync.shopify_sync import ShopifySyncEngine
from src.sync.tasks.shopify_sync_tasks import get_sync_engine, sync_all
from src.sync.sync_engine.models import SyncStatus, SyncType


class TestExternalPlatformAPI:
    """Mock External Platform API for integration testing."""
    
    def __init__(self, platform_name="test_platform"):
        self.platform_name = platform_name
        self.products = {}
        self.inventory = {}
        self.orders = []
        self.customers = {}
        
        # Track API calls
        self.sync_products_calls = 0
        self.sync_inventory_calls = 0
        self.get_orders_calls = 0
        self.sync_customers_calls = 0
    
    async def initialize(self):
        """Initialize the API client."""
        return True
    
    def sync_products(self, shopify_products):
        """Sync products from Shopify to the platform."""
        self.sync_products_calls += 1
        
        # Store products
        for product in shopify_products:
            self.products[product['id']] = product
        
        return {
            "processed": len(shopify_products),
            "timestamp": datetime.now().isoformat()
        }
    
    def sync_inventory(self, shopify_inventory):
        """Sync inventory from Shopify to the platform."""
        self.sync_inventory_calls += 1
        
        # Store inventory
        for inventory in shopify_inventory:
            self.inventory[inventory['inventory_item_id']] = inventory
        
        return {
            "processed": len(shopify_inventory),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_orders(self):
        """Get orders from the platform."""
        self.get_orders_calls += 1
        
        # Return some mock orders
        return self.orders
    
    def sync_customers(self, shopify_customers):
        """Sync customers from Shopify to the platform."""
        self.sync_customers_calls += 1
        
        # Store customers
        for customer in shopify_customers:
            self.customers[customer['id']] = customer
        
        return {
            "processed": len(shopify_customers),
            "timestamp": datetime.now().isoformat()
        }
    
    def add_order(self, order):
        """Add an order to the platform."""
        self.orders.append(order)


@pytest.mark.integration
class TestShopifySyncIntegration:
    """Integration tests for Shopify Sync Engine."""
    
    @pytest.fixture
    def external_platforms(self):
        """Create multiple external platform API instances."""
        return {
            "platform1": TestExternalPlatformAPI("platform1"),
            "platform2": TestExternalPlatformAPI("platform2")
        }
    
    @pytest.mark.asyncio
    async def test_multi_platform_integration(self, mock_shopify_api, external_platforms):
        """Test integration with multiple external platforms."""
        # Create sync engine with Shopify API
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register external platforms
        for name, api in external_platforms.items():
            engine.register_external_api(name, api)
        
        # Initialize the engine
        init_result = await engine.initialize()
        assert init_result is True
        
        # Perform full sync
        sync_result = engine.sync_all()
        
        # Verify successful sync
        assert sync_result['status'] == 'success'
        assert sync_result['synced_count'] > 0
        assert sync_result['failed_count'] == 0
        
        # Verify all platforms were synced
        for platform_name in external_platforms.keys():
            assert platform_name in sync_result['platforms']
        
        # Verify API calls to each platform
        for platform in external_platforms.values():
            assert platform.sync_products_calls == 1
            assert platform.sync_inventory_calls == 1
            assert platform.get_orders_calls == 1
            assert platform.sync_customers_calls == 1
            
            # Verify data was stored in each platform
            assert len(platform.products) == len(mock_shopify_api.get_products())
            assert len(platform.inventory) == len(mock_shopify_api.get_inventory_levels())
            assert len(platform.customers) == len(mock_shopify_api.get_customers())
    
    @pytest.mark.asyncio
    async def test_bidirectional_sync(self, mock_shopify_api, external_platforms):
        """Test bidirectional sync (Shopify to platform and platform to Shopify)."""
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register one external platform
        platform = list(external_platforms.values())[0]
        engine.register_external_api("test_platform", platform)
        
        # Initialize the engine
        init_result = await engine.initialize()
        assert init_result is True
        
        # Add an order to the external platform
        platform.add_order({
            "id": "ext_order_1",
            "customer_id": "ext_cust_1",
            "order_date": datetime.now().isoformat(),
            "total": 100.0
        })
        
        # Perform orders sync (pulls from platform to Shopify)
        sync_result = engine.sync_orders_only()
        
        # Verify successful sync
        assert sync_result['status'] == 'success'
        assert sync_result['synced_count'] > 0
        assert sync_result['platforms']['test_platform']['status'] == 'success'
    
    @pytest.mark.asyncio
    async def test_partial_sync_failure(self, mock_shopify_api, external_platforms):
        """Test handling of partial sync failures."""
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register platforms - one normal, one that fails
        normal_platform = list(external_platforms.values())[0]
        engine.register_external_api("normal_platform", normal_platform)
        
        # Create a platform that fails during sync
        failing_platform = Mock()
        failing_platform.initialize = AsyncMock(return_value=True)
        failing_platform.sync_products = Mock(side_effect=Exception("Sync failed"))
        failing_platform.sync_inventory = Mock(return_value={"status": "success", "count": 2})
        failing_platform.get_orders = Mock(return_value=[])
        failing_platform.sync_customers = Mock(return_value={"status": "success", "count": 1})
        engine.register_external_api("failing_platform", failing_platform)
        
        # Initialize the engine
        init_result = await engine.initialize()
        assert init_result is True
        
        # Perform full sync
        sync_result = engine.sync_all()
        
        # Verify partial success
        assert sync_result['status'] == 'partial'
        assert sync_result['synced_count'] > 0
        assert sync_result['failed_count'] > 0
        assert len(sync_result['errors']) > 0
        
        # Verify normal platform succeeded and failing platform failed for products
        assert sync_result['platforms']['normal_platform']['products']['status'] == 'success'
        assert sync_result['platforms']['failing_platform']['products']['status'] == 'error'
        
        # Verify other sync types still succeeded for failing platform
        assert sync_result['platforms']['failing_platform']['inventory']['status'] == 'success'
    
    def test_scheduler_integration(self, mock_shopify_api, external_platforms):
        """Test integration with the scheduler."""
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register external platform
        platform = list(external_platforms.values())[0]
        engine.register_external_api("test_platform", platform)
        
        # Start the scheduler with a very short interval
        engine.start(interval_seconds=2)
        
        # Wait for at least one sync to occur
        time.sleep(3)
        
        # Stop the scheduler
        engine.stop()
        
        # Verify sync occurred
        assert platform.sync_products_calls >= 1
        assert platform.sync_inventory_calls >= 1
        assert platform.get_orders_calls >= 1
        assert platform.sync_customers_calls >= 1
        
        # Verify status information
        status = engine.get_status()
        assert status['running'] is False
        assert status['last_sync_time'] is not None
        assert len(status['latest_syncs']) > 0
    
    @patch('src.sync.tasks.shopify_sync_tasks.ShopifyAPI')
    @patch('src.sync.tasks.shopify_sync_tasks._sync_engine', None)  # Reset singleton
    def test_celery_task_integration(self, mock_shopify_api_class, mock_shopify_api, external_platforms):
        """Test integration with Celery tasks."""
        # Configure the mock class to return our mock instance
        mock_shopify_api_class.return_value = mock_shopify_api
        
        # Get engine from the task module (should initialize)
        task_engine = get_sync_engine()
        
        # Register external platform
        platform = list(external_platforms.values())[0]
        task_engine.register_external_api("test_platform", platform)
        
        # Execute sync task
        result = sync_all()
        
        # Verify task execution
        assert result['status'] == 'success'
        assert platform.sync_products_calls == 1
        assert platform.sync_inventory_calls == 1
        assert platform.get_orders_calls == 1
        assert platform.sync_customers_calls == 1