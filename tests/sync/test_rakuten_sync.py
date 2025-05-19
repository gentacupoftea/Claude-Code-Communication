"""
Tests for Rakuten synchronization
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

from src.sync.rakuten_sync import (
    RakutenSync,
    SyncConfig,
    SyncResult,
    SyncScheduler
)
from src.api.abstract import PlatformType, platform_manager


class TestSyncConfig:
    """Test sync configuration"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = SyncConfig()
        
        assert config.batch_size == 50
        assert config.sync_interval == 300
        assert config.retry_attempts == 3
        assert config.sync_products is True
        assert config.sync_inventory is True
        assert config.sync_orders is True
        assert config.sync_customers is False
        assert config.sync_direction == 'bidirectional'
        assert config.conflict_resolution == 'newest'
    
    def test_custom_config(self):
        """Test custom configuration"""
        config = SyncConfig(
            batch_size=100,
            sync_interval=600,
            sync_direction='shopify_to_rakuten',
            sync_customers=True
        )
        
        assert config.batch_size == 100
        assert config.sync_interval == 600
        assert config.sync_direction == 'shopify_to_rakuten'
        assert config.sync_customers is True


class TestRakutenSync:
    """Test Rakuten sync manager"""
    
    @pytest.fixture
    def sync_config(self):
        """Test sync configuration"""
        return SyncConfig(
            batch_size=10,
            sync_interval=60,
            sync_products=True,
            sync_inventory=True,
            sync_orders=True
        )
    
    @pytest.fixture
    def sync_manager(self, sync_config):
        """Create sync manager"""
        return RakutenSync(sync_config)
    
    @pytest.mark.asyncio
    async def test_initialize(self, sync_manager):
        """Test platform initialization"""
        shopify_creds = {
            'shop_url': 'https://test.myshopify.com',
            'access_token': 'test_token'
        }
        
        rakuten_creds = {
            'service_secret': 'test_secret',
            'license_key': 'test_key',
            'shop_id': 'test_shop'
        }
        
        # Mock platform manager
        with patch('src.sync.rakuten_sync.platform_manager') as mock_pm:
            mock_pm.check_all_connections = AsyncMock(return_value={
                PlatformType.SHOPIFY: True,
                PlatformType.RAKUTEN: True
            })
            
            # Mock client classes
            with patch('src.sync.rakuten_sync.OptimizedShopifyGraphQL') as mock_shopify:
                with patch('src.sync.rakuten_sync.RakutenAPIClient') as mock_rakuten:
                    mock_shopify_instance = Mock()
                    mock_shopify_instance.start = AsyncMock()
                    mock_shopify.return_value = mock_shopify_instance
                    
                    result = await sync_manager.initialize(shopify_creds, rakuten_creds)
                    
                    assert result is True
                    mock_shopify.assert_called_once()
                    mock_rakuten.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_sync_products(self, sync_manager):
        """Test product synchronization"""
        # Mock platform clients
        shopify_client = Mock()
        rakuten_client = Mock()
        
        with patch('src.sync.rakuten_sync.platform_manager.get_platform') as mock_get:
            mock_get.side_effect = lambda p: {
                PlatformType.SHOPIFY: shopify_client,
                PlatformType.RAKUTEN: rakuten_client
            }.get(p)
            
            # Mock sync methods
            sync_manager._sync_products_from_shopify = AsyncMock(
                return_value=SyncResult(success=True, synced_count=5)
            )
            sync_manager._sync_products_from_rakuten = AsyncMock(
                return_value=SyncResult(success=True, synced_count=3)
            )
            
            result = await sync_manager.sync_products()
            
            assert result.success is True
            assert result.synced_count == 8
            assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_sync_products_error_handling(self, sync_manager):
        """Test product sync error handling"""
        # Mock error
        sync_manager._sync_products_from_shopify = AsyncMock(
            side_effect=Exception('Sync failed')
        )
        
        result = await sync_manager.sync_products()
        
        assert result.success is False
        assert 'Sync failed' in result.errors[0]
    
    @pytest.mark.asyncio
    async def test_sync_inventory(self, sync_manager):
        """Test inventory synchronization"""
        # Mock products
        shopify_products = [
            {'sku': 'SKU001', 'inventory_quantity': 100, 'updated_at': datetime.now().isoformat()},
            {'sku': 'SKU002', 'inventory_quantity': 50, 'updated_at': datetime.now().isoformat()}
        ]
        
        rakuten_products = [
            {'sku': 'SKU001', 'inventory_quantity': 80, 'updated_at': (datetime.now() - timedelta(hours=1)).isoformat()},
            {'sku': 'SKU002', 'inventory_quantity': 50, 'updated_at': datetime.now().isoformat()}
        ]
        
        sync_manager._get_all_products = AsyncMock(side_effect=[
            shopify_products,
            rakuten_products
        ])
        
        with patch('src.sync.rakuten_sync.platform_manager.sync_inventory_across_platforms') as mock_sync:
            mock_sync.return_value = {
                PlatformType.SHOPIFY: True,
                PlatformType.RAKUTEN: True
            }
            
            result = await sync_manager.sync_inventory()
            
            assert result.success is True
            assert result.synced_count == 1  # Only SKU001 has different quantities
            
            # Verify correct quantity was synced (Shopify is newer)
            mock_sync.assert_called_once_with('SKU001', 100)
    
    @pytest.mark.asyncio
    async def test_sync_orders(self, sync_manager):
        """Test order synchronization"""
        # Mock recent orders
        recent_orders = [
            {'order_number': 'ORD-001', 'status': 'processing'},
            {'order_number': 'ORD-002', 'status': 'shipped'}
        ]
        
        sync_manager._get_recent_orders = AsyncMock(return_value=recent_orders)
        sync_manager._create_rakuten_order = AsyncMock()
        sync_manager._create_shopify_order = AsyncMock()
        
        result = await sync_manager.sync_orders()
        
        assert result.success is True
        # Orders should be created based on sync direction
        if sync_manager.config.sync_direction == 'bidirectional':
            assert sync_manager._create_rakuten_order.call_count > 0
    
    @pytest.mark.asyncio
    async def test_sync_customers(self, sync_manager):
        """Test customer synchronization (should be skipped)"""
        result = await sync_manager.sync_customers()
        
        assert result.success is True
        assert result.skipped_count == 1
        assert result.synced_count == 0
    
    @pytest.mark.asyncio
    async def test_sync_loop(self, sync_manager):
        """Test continuous sync loop"""
        sync_manager.sync_products = AsyncMock(
            return_value=SyncResult(success=True, synced_count=5)
        )
        sync_manager.sync_inventory = AsyncMock(
            return_value=SyncResult(success=True, synced_count=3)
        )
        sync_manager.sync_orders = AsyncMock(
            return_value=SyncResult(success=True, synced_count=2)
        )
        
        # Start sync
        await sync_manager.start_sync()
        assert sync_manager.is_running is True
        
        # Let it run for a short time
        await asyncio.sleep(0.1)
        
        # Stop sync
        await sync_manager.stop_sync()
        assert sync_manager.is_running is False
        
        # Verify methods were called
        assert sync_manager.sync_products.called
        assert sync_manager.sync_inventory.called
        assert sync_manager.sync_orders.called
    
    def test_should_update_product(self, sync_manager):
        """Test product update decision logic"""
        source = {
            'title': 'New Title',
            'price': '100',
            'updated_at': datetime.now().isoformat()
        }
        
        target = {
            'title': 'Old Title',
            'price': '100',
            'updated_at': (datetime.now() - timedelta(hours=1)).isoformat()
        }
        
        # Should update due to different title
        assert sync_manager._should_update_product(source, target) is True
        
        # Same data, but source is newer
        target['title'] = 'New Title'
        sync_manager.config.conflict_resolution = 'newest'
        assert sync_manager._should_update_product(source, target) is True
        
        # Same data, target is newer
        source['updated_at'] = (datetime.now() - timedelta(hours=2)).isoformat()
        assert sync_manager._should_update_product(source, target) is False
    
    def test_should_sync_order(self, sync_manager):
        """Test order sync decision logic"""
        # Normal order - should sync
        order = {'status': 'processing', 'test': False}
        assert sync_manager._should_sync_order(order) is True
        
        # Cancelled order - should not sync
        order = {'status': 'cancelled', 'test': False}
        assert sync_manager._should_sync_order(order) is False
        
        # Test order - should not sync
        order = {'status': 'processing', 'test': True}
        assert sync_manager._should_sync_order(order) is False


class TestSyncScheduler:
    """Test sync scheduler"""
    
    @pytest.fixture
    def sync_manager(self):
        """Create sync manager"""
        return RakutenSync(SyncConfig(sync_interval=1))
    
    @pytest.fixture
    def scheduler(self, sync_manager):
        """Create scheduler"""
        return SyncScheduler(sync_manager)
    
    @pytest.mark.asyncio
    async def test_scheduler_start_stop(self, scheduler):
        """Test scheduler start/stop"""
        scheduler.sync_manager.start_sync = AsyncMock()
        
        # Start scheduler
        await scheduler.start()
        assert scheduler.is_running is True
        
        # Let it run
        await asyncio.sleep(0.1)
        
        # Stop scheduler
        await scheduler.stop()
        assert scheduler.is_running is False
        
        # Verify sync was called
        assert scheduler.sync_manager.start_sync.called
    
    @pytest.mark.asyncio
    async def test_scheduler_error_handling(self, scheduler):
        """Test scheduler error handling"""
        scheduler.sync_manager.start_sync = AsyncMock(
            side_effect=Exception('Sync error')
        )
        
        # Start scheduler
        await scheduler.start()
        
        # Let it run and handle error
        await asyncio.sleep(0.1)
        
        # Should continue running despite error
        assert scheduler.is_running is True
        
        # Stop scheduler
        await scheduler.stop()