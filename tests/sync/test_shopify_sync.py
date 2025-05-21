"""
Tests for ShopifySyncEngine.
"""

import pytest
import threading
import time
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from src.sync.shopify_sync import ShopifySyncEngine
from src.sync.sync_engine.models import SyncStatus, SyncType, SyncResult


class TestShopifySyncEngine:
    """Test class for ShopifySyncEngine."""
    
    def test_initialization(self, mock_shopify_api):
        """Test engine initialization."""
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        
        assert engine.shopify_api == mock_shopify_api
        assert isinstance(engine.external_apis, dict)
        assert len(engine.external_apis) == 0
        assert engine.sync_thread is None
        assert isinstance(engine.sync_history, object)
        assert engine.last_sync_time is None
    
    def test_register_external_api(self, sync_engine, mock_external_api):
        """Test registering an external API client."""
        # Register a new API client
        new_api = Mock()
        sync_engine.register_external_api("new_platform", new_api)
        
        # Check that both APIs are registered
        assert len(sync_engine.external_apis) == 2
        assert sync_engine.external_apis["test_platform"] == mock_external_api
        assert sync_engine.external_apis["new_platform"] == new_api
    
    @pytest.mark.asyncio
    async def test_initialize_success(self, sync_engine):
        """Test successful initialization."""
        result = await sync_engine.initialize()
        
        assert result is True
        # Verify the external API's initialize method was called
        sync_engine.external_apis["test_platform"].initialize.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_initialize_failure_no_shopify_api(self):
        """Test initialization failure when Shopify API is not set."""
        engine = ShopifySyncEngine(shopify_api=None)
        result = await engine.initialize()
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_initialize_failure_external_api_error(self, mock_shopify_api):
        """Test initialization failure when external API initialization fails."""
        # Create a mock external API that raises an exception during initialization
        mock_error_api = Mock()
        mock_error_api.initialize = AsyncMock(side_effect=Exception("API initialization failed"))
        
        engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
        engine.register_external_api("error_platform", mock_error_api)
        
        result = await engine.initialize()
        
        assert result is False
    
    def test_start_success(self, sync_engine):
        """Test successfully starting the sync engine."""
        # Mock the _run_scheduler method to prevent actual thread execution
        with patch.object(sync_engine, '_run_scheduler') as mock_run:
            result = sync_engine.start(interval_seconds=10)
            
            assert result is True
            assert sync_engine.sync_thread is not None
            assert sync_engine.sync_thread.daemon is True
            mock_run.assert_not_called()  # The method is not called directly but passed to the thread
    
    def test_start_already_running(self, sync_engine):
        """Test start when engine is already running."""
        # First start the engine
        with patch.object(sync_engine, '_run_scheduler'):
            sync_engine.start(interval_seconds=10)
            
            # Try to start it again
            result = sync_engine.start(interval_seconds=10)
            
            assert result is False
    
    def test_stop_success(self, sync_engine):
        """Test successfully stopping the sync engine."""
        # First start the engine with a mocked _run_scheduler
        with patch.object(sync_engine, '_run_scheduler'):
            sync_engine.start(interval_seconds=10)
            
            # Now stop it
            sync_engine.stop()
            
            assert sync_engine.stop_event.is_set()
    
    def test_stop_not_running(self, sync_engine):
        """Test stopping when engine is not running."""
        # The engine is not started
        sync_engine.stop()
        
        # Should not raise exception, just return
        assert sync_engine.sync_thread is None
    
    def test_sync_all(self, sync_engine, mock_external_api):
        """Test syncing all data types."""
        result = sync_engine.sync_all()
        
        # Check result structure
        assert 'status' in result
        assert 'started_at' in result
        assert 'completed_at' in result
        assert 'duration_seconds' in result
        assert 'platforms' in result
        assert 'synced_count' in result
        assert 'failed_count' in result
        assert 'skipped_count' in result
        
        # Check that sync methods were called on the external API
        mock_external_api.sync_products.assert_called_once()
        mock_external_api.sync_inventory.assert_called_once()
        mock_external_api.get_orders.assert_called_once()
        mock_external_api.sync_customers.assert_called_once()
        
        # Check that update_duration was called on the result
        assert result['duration_seconds'] > 0
    
    def test_sync_all_with_error(self, sync_engine, mock_external_api):
        """Test syncing all data with an error in one sync operation."""
        # Make one sync method fail
        mock_external_api.sync_products.side_effect = Exception("Sync failed")
        
        result = sync_engine.sync_all()
        
        # Check error handling
        assert result['status'] == 'partial'
        assert result['failed_count'] > 0
        assert len(result['errors']) > 0
        assert 'platforms' in result
        assert 'test_platform' in result['platforms']
        assert result['platforms']['test_platform']['products']['status'] == 'error'
    
    def test_sync_products_only(self, sync_engine, mock_external_api):
        """Test syncing only products."""
        result = sync_engine.sync_products_only()
        
        # Check that only product sync was called
        mock_external_api.sync_products.assert_called_once()
        mock_external_api.sync_inventory.assert_not_called()
        mock_external_api.get_orders.assert_not_called()
        mock_external_api.sync_customers.assert_not_called()
        
        # Check result
        assert result['status'] == 'success'
        assert 'platforms' in result
        assert 'test_platform' in result['platforms']
    
    def test_sync_inventory_only(self, sync_engine, mock_external_api):
        """Test syncing only inventory."""
        result = sync_engine.sync_inventory_only()
        
        # Check that only inventory sync was called
        mock_external_api.sync_products.assert_not_called()
        mock_external_api.sync_inventory.assert_called_once()
        mock_external_api.get_orders.assert_not_called()
        mock_external_api.sync_customers.assert_not_called()
        
        # Check result
        assert result['status'] == 'success'
        assert 'platforms' in result
        assert 'test_platform' in result['platforms']
    
    def test_sync_orders_only(self, sync_engine, mock_external_api):
        """Test syncing only orders."""
        result = sync_engine.sync_orders_only()
        
        # Check that only order sync was called
        mock_external_api.sync_products.assert_not_called()
        mock_external_api.sync_inventory.assert_not_called()
        mock_external_api.get_orders.assert_called_once()
        mock_external_api.sync_customers.assert_not_called()
        
        # Check result
        assert result['status'] == 'success'
        assert 'platforms' in result
        assert 'test_platform' in result['platforms']
    
    def test_sync_customers_only(self, sync_engine, mock_external_api):
        """Test syncing only customers."""
        result = sync_engine.sync_customers_only()
        
        # Check that only customer sync was called
        mock_external_api.sync_products.assert_not_called()
        mock_external_api.sync_inventory.assert_not_called()
        mock_external_api.get_orders.assert_not_called()
        mock_external_api.sync_customers.assert_called_once()
        
        # Check result
        assert result['status'] == 'success'
        assert 'platforms' in result
        assert 'test_platform' in result['platforms']
    
    def test_get_status(self, sync_engine, sample_sync_history):
        """Test getting engine status."""
        # Set sample history
        sync_engine.sync_history = sample_sync_history
        sync_engine.last_sync_time = datetime.now()
        
        status = sync_engine.get_status()
        
        # Check status structure
        assert 'running' in status
        assert 'last_sync_time' in status
        assert 'registered_platforms' in status
        assert 'latest_syncs' in status
        assert 'success_rate' in status
        
        # Check content
        assert status['registered_platforms'] == ['test_platform']
        
        # Check latest syncs includes each sync type
        for sync_type in [SyncType.PRODUCTS.value, SyncType.INVENTORY.value, 
                          SyncType.ORDERS.value, SyncType.CUSTOMERS.value]:
            assert sync_type in status['latest_syncs']
    
    def test_get_history(self, sync_engine, sample_sync_history):
        """Test getting sync history."""
        # Set sample history
        sync_engine.sync_history = sample_sync_history
        
        history = sync_engine.get_history()
        
        # Check that history contains the expected number of entries
        assert len(history) == len(sample_sync_history.results)
        
        # Check entry structure
        assert 'status' in history[0]
        assert 'sync_type' in history[0]
        assert 'synced_count' in history[0]
        assert 'failed_count' in history[0]
        assert 'start_time' in history[0]
        assert 'end_time' in history[0]
        assert 'duration' in history[0]
    
    def test_sync_platform(self, sync_engine, mock_external_api):
        """Test syncing a specific platform."""
        result = sync_engine._sync_platform("test_platform", mock_external_api)
        
        # Check that all sync methods were called
        mock_external_api.sync_products.assert_called_once()
        mock_external_api.sync_inventory.assert_called_once()
        mock_external_api.get_orders.assert_called_once()
        mock_external_api.sync_customers.assert_called_once()
        
        # Check result structure
        assert 'products' in result
        assert 'inventory' in result
        assert 'orders' in result
        assert 'customers' in result
    
    def test_sync_products(self, sync_engine, mock_external_api, mock_shopify_api):
        """Test _sync_products method."""
        result = sync_engine._sync_products("test_platform", mock_external_api)
        
        # Check API interactions
        mock_shopify_api.get_products.assert_called_once()
        mock_external_api.sync_products.assert_called_once()
        
        # Check result
        assert result['status'] == 'success'
        assert result['synced_count'] == len(mock_shopify_api.get_products())
    
    def test_sync_products_not_supported(self, sync_engine, mock_external_api):
        """Test _sync_products when platform doesn't support it."""
        # Remove sync_products method
        del mock_external_api.sync_products
        
        result = sync_engine._sync_products("test_platform", mock_external_api)
        
        # Check result
        assert result['status'] == 'skipped'
        assert result['reason'] == 'not_supported'
    
    def test_sync_products_error(self, sync_engine, mock_external_api):
        """Test _sync_products with error."""
        # Make sync_products raise an exception
        mock_external_api.sync_products.side_effect = Exception("Sync failed")
        
        result = sync_engine._sync_products("test_platform", mock_external_api)
        
        # Check error handling
        assert result['status'] == 'error'
        assert 'error' in result
        assert "Sync failed" in result['error']
    
    def test_sync_inventory(self, sync_engine, mock_external_api, mock_shopify_api):
        """Test _sync_inventory method."""
        result = sync_engine._sync_inventory("test_platform", mock_external_api)
        
        # Check API interactions
        mock_shopify_api.get_inventory_levels.assert_called_once()
        mock_external_api.sync_inventory.assert_called_once()
        
        # Check result
        assert result['status'] == 'success'
        assert result['synced_count'] == len(mock_shopify_api.get_inventory_levels())
    
    def test_sync_orders(self, sync_engine, mock_external_api):
        """Test _sync_orders method."""
        result = sync_engine._sync_orders("test_platform", mock_external_api)
        
        # Check API interactions
        mock_external_api.get_orders.assert_called_once()
        
        # Check result
        assert result['status'] == 'success'
        assert result['synced_count'] == 1  # One order in mock
    
    def test_sync_customers(self, sync_engine, mock_external_api, mock_shopify_api):
        """Test _sync_customers method."""
        result = sync_engine._sync_customers("test_platform", mock_external_api)
        
        # Check API interactions
        mock_shopify_api.get_customers.assert_called_once()
        mock_external_api.sync_customers.assert_called_once()
        
        # Check result
        assert result['status'] == 'success'
        assert result['synced_count'] == len(mock_shopify_api.get_customers())