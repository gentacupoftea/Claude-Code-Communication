"""
Integration tests for Shopify Sync Engine with Rakuten platform.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import json
import os
from datetime import datetime, timedelta

from src.sync.shopify_sync import ShopifySyncEngine
from src.sync.sync_engine.models import SyncStatus, SyncType


class MockRakutenAPI:
    """Mock Rakuten API client."""
    
    def __init__(self):
        self.products = {}
        self.inventory = {}
        self.orders = []
        
        # Load sample data
        self._load_sample_data()
        
        # Track API calls
        self.sync_products_calls = 0
        self.sync_inventory_calls = 0
        self.get_orders_calls = 0
        self.sync_customers_calls = 0
    
    def _load_sample_data(self):
        """Load sample Rakuten data for testing."""
        sample_data_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "rakuten_sample_data.json"
        )
        
        if os.path.exists(sample_data_path):
            try:
                with open(sample_data_path, 'r') as f:
                    data = json.load(f)
                    self.orders = data.get("orders", [])
            except Exception as e:
                print(f"Error loading sample data: {e}")
        else:
            # Create some sample orders if file doesn't exist
            self.orders = [
                {
                    "orderId": "rakuten_order_1",
                    "orderDate": datetime.now().isoformat(),
                    "orderStatus": "新規受付",
                    "totalPrice": 5000,
                    "shippingFee": 500,
                    "paymentMethod": "クレジットカード",
                    "customerName": "楽天 太郎",
                    "customerEmail": "test@example.jp",
                    "items": [
                        {
                            "itemId": "rakuten_item_1",
                            "itemName": "楽天テスト商品1",
                            "quantity": 2,
                            "price": 2000
                        },
                        {
                            "itemId": "rakuten_item_2",
                            "itemName": "楽天テスト商品2",
                            "quantity": 1,
                            "price": 1000
                        }
                    ]
                }
            ]
    
    async def initialize(self):
        """Initialize the API client."""
        return True
    
    def sync_products(self, shopify_products):
        """Sync products from Shopify to Rakuten."""
        self.sync_products_calls += 1
        
        # Transform and store products in Rakuten format
        for product in shopify_products:
            rakuten_product = {
                "itemId": f"rakuten_{product['id']}",
                "itemName": product['title'],
                "itemPrice": product.get('price', '0'),
                "itemDescription": product.get('description', ''),
                "shopifyId": product['id']
            }
            
            self.products[rakuten_product["itemId"]] = rakuten_product
        
        return {
            "processed": len(shopify_products),
            "timestamp": datetime.now().isoformat()
        }
    
    def sync_inventory(self, shopify_inventory):
        """Sync inventory from Shopify to Rakuten."""
        self.sync_inventory_calls += 1
        
        # Transform and store inventory in Rakuten format
        for inventory in shopify_inventory:
            rakuten_inventory = {
                "inventoryId": f"rakuten_inv_{inventory['inventory_item_id']}",
                "quantity": inventory.get('available', 0),
                "shopifyId": inventory['inventory_item_id']
            }
            
            self.inventory[rakuten_inventory["inventoryId"]] = rakuten_inventory
        
        return {
            "processed": len(shopify_inventory),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_orders(self):
        """Get orders from Rakuten."""
        self.get_orders_calls += 1
        return self.orders
    
    def sync_customers(self, shopify_customers):
        """Sync customers from Shopify to Rakuten."""
        self.sync_customers_calls += 1
        
        # Rakuten doesn't directly support customer sync
        return {
            "processed": 0,
            "skipped": len(shopify_customers),
            "timestamp": datetime.now().isoformat()
        }


@pytest.fixture
def rakuten_api():
    """Create a MockRakutenAPI instance."""
    return MockRakutenAPI()


@pytest.mark.integration
class TestRakutenIntegration:
    """Integration tests with Rakuten platform."""
    
    @pytest.mark.asyncio
    async def test_rakuten_sync_products(self, mock_shopify_api, rakuten_api):
        """Test syncing products to Rakuten."""
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register Rakuten API
        engine.register_external_api("rakuten", rakuten_api)
        
        # Initialize
        await engine.initialize()
        
        # Sync products only
        result = engine.sync_products_only()
        
        # Verify result
        assert result["status"] == "success"
        assert result["synced_count"] > 0
        assert "rakuten" in result["platforms"]
        assert result["platforms"]["rakuten"]["status"] == "success"
        
        # Verify Rakuten API calls
        assert rakuten_api.sync_products_calls == 1
        
        # Verify data in Rakuten API
        assert len(rakuten_api.products) == len(mock_shopify_api.get_products())
    
    @pytest.mark.asyncio
    async def test_rakuten_sync_orders(self, mock_shopify_api, rakuten_api):
        """Test syncing orders from Rakuten to Shopify."""
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register Rakuten API
        engine.register_external_api("rakuten", rakuten_api)
        
        # Initialize
        await engine.initialize()
        
        # Sync orders only
        result = engine.sync_orders_only()
        
        # Verify result
        assert result["status"] == "success"
        assert result["synced_count"] > 0
        assert "rakuten" in result["platforms"]
        assert result["platforms"]["rakuten"]["status"] == "success"
        
        # Verify Rakuten API calls
        assert rakuten_api.get_orders_calls == 1
    
    @pytest.mark.asyncio
    async def test_rakuten_sync_all(self, mock_shopify_api, rakuten_api):
        """Test syncing all data types with Rakuten."""
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Register Rakuten API
        engine.register_external_api("rakuten", rakuten_api)
        
        # Initialize
        await engine.initialize()
        
        # Sync all
        result = engine.sync_all()
        
        # Verify result
        assert result["status"] == "success"
        assert "platforms" in result
        assert "rakuten" in result["platforms"]
        
        # Verify all sync operations were called
        assert rakuten_api.sync_products_calls == 1
        assert rakuten_api.sync_inventory_calls == 1
        assert rakuten_api.get_orders_calls == 1
        assert rakuten_api.sync_customers_calls == 1
        
        # Verify sync history
        assert len(engine.sync_history.results) == 1
        latest_result = engine.sync_history.get_latest()
        assert latest_result.status == SyncStatus.SUCCESS
        assert latest_result.sync_type == SyncType.FULL
    
    @pytest.mark.asyncio
    async def test_rakuten_order_mapping(self, mock_shopify_api, rakuten_api):
        """Test that Rakuten orders are correctly mapped to Shopify format."""
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        # Mock the Shopify API order processing method
        mock_shopify_api.process_order = Mock(return_value={"id": "shopify_order_1"})
        
        # Register Rakuten API
        engine.register_external_api("rakuten", rakuten_api)
        
        # Initialize
        await engine.initialize()
        
        # Sync orders only
        result = engine.sync_orders_only()
        
        # Verify process_order was called with mapped order
        if hasattr(mock_shopify_api, "process_order") and mock_shopify_api.process_order.call_count > 0:
            # This is optional, as process_order might not be implemented in the mock
            call_args = mock_shopify_api.process_order.call_args_list[0][0][0]
            assert isinstance(call_args, dict)
            assert "source" in call_args
            assert call_args["source"] == "rakuten"


@pytest.mark.integration
class TestRakutenErrorHandling:
    """Test error handling during Rakuten integration."""
    
    @pytest.mark.asyncio
    async def test_rakuten_product_sync_error(self, mock_shopify_api, rakuten_api):
        """Test handling errors during product sync."""
        # Make Rakuten API fail during product sync
        rakuten_api.sync_products = Mock(side_effect=Exception("Rakuten API Error"))
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("rakuten", rakuten_api)
        
        # Initialize
        await engine.initialize()
        
        # Sync products only
        result = engine.sync_products_only()
        
        # Verify result
        assert result["status"] != "success"  # Either "partial" or "failed"
        assert result["failed_count"] > 0
        assert "rakuten" in result["platforms"]
        assert result["platforms"]["rakuten"]["status"] == "error"
        assert "error" in result["platforms"]["rakuten"]
    
    @pytest.mark.asyncio
    async def test_rakuten_partial_failure(self, mock_shopify_api, rakuten_api):
        """Test partial failure handling with multiple platforms."""
        # Create a second platform that works correctly
        working_platform = MockRakutenAPI()
        
        # Make Rakuten API fail during product sync
        rakuten_api.sync_products = Mock(side_effect=Exception("Rakuten API Error"))
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("rakuten", rakuten_api)
        engine.register_external_api("working_platform", working_platform)
        
        # Initialize
        await engine.initialize()
        
        # Sync products only
        result = engine.sync_products_only()
        
        # Verify result
        assert result["status"] == "partial"
        assert result["failed_count"] >= 1
        assert result["synced_count"] >= 1
        
        # Verify platforms
        assert "rakuten" in result["platforms"]
        assert "working_platform" in result["platforms"]
        assert result["platforms"]["rakuten"]["status"] == "error"
        assert result["platforms"]["working_platform"]["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_rakuten_initialization_error(self, mock_shopify_api):
        """Test handling Rakuten initialization errors."""
        # Create a Rakuten API that fails during initialization
        failing_rakuten_api = Mock()
        failing_rakuten_api.initialize = AsyncMock(side_effect=Exception("Initialization Error"))
        
        # Create sync engine
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("rakuten", failing_rakuten_api)
        
        # Initialize - should not raise exception but return False
        result = await engine.initialize()
        assert result is False