"""
Tests for Shopify synchronization tasks (Celery).
"""

import pytest
from unittest.mock import Mock, patch, ANY
from datetime import datetime, timedelta

from src.sync.tasks.shopify_sync_tasks import (
    get_sync_engine,
    sync_all,
    sync_products,
    sync_inventory,
    sync_orders,
    sync_customers,
    run_scheduled_sync,
    get_sync_status,
    get_sync_history
)


class TestShopifySyncTasks:
    """Test class for Shopify sync tasks."""
    
    @patch('src.sync.tasks.shopify_sync_tasks.ShopifyAPI')
    @patch('src.sync.tasks.shopify_sync_tasks._sync_engine')
    def test_get_sync_engine_singleton(self, mock_engine, mock_shopify_api):
        """Test that get_sync_engine returns a singleton instance."""
        # Set mock_engine to None to simulate first call
        mock_engine = None
        
        # First call should create a new instance
        result1 = get_sync_engine()
        
        # Second call should return the same instance
        result2 = get_sync_engine()
        
        assert result1 == result2
        mock_shopify_api.assert_called_once()
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_all(self, mock_get_engine):
        """Test sync_all task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_all.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = sync_all()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_all.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_products(self, mock_get_engine):
        """Test sync_products task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_products_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = sync_products()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_products_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_inventory(self, mock_get_engine):
        """Test sync_inventory task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_inventory_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = sync_inventory()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_inventory_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_orders(self, mock_get_engine):
        """Test sync_orders task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_orders_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = sync_orders()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_orders_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_orders_with_date_params(self, mock_get_engine):
        """Test sync_orders task with date parameters."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_orders_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Set date parameters
        start_date = "2023-01-01T00:00:00Z"
        end_date = "2023-01-31T23:59:59Z"
        
        # Run task
        result = sync_orders(start_date=start_date, end_date=end_date)
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_orders_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_orders_with_default_dates(self, mock_get_engine):
        """Test sync_orders task with default date parameters."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_orders_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task with no date parameters
        result = sync_orders()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_orders_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_sync_customers(self, mock_get_engine):
        """Test sync_customers task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_customers_only.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = sync_customers()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_customers_only.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_run_scheduled_sync(self, mock_get_engine):
        """Test run_scheduled_sync task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.sync_all.return_value = {'status': 'success'}
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = run_scheduled_sync()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.sync_all.assert_called_once()
        assert result == {'status': 'success'}
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_get_sync_status(self, mock_get_engine):
        """Test get_sync_status task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.get_status.return_value = {
            'running': False,
            'last_sync_time': datetime.now().isoformat(),
            'registered_platforms': ['test_platform'],
            'latest_syncs': {}
        }
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = get_sync_status()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.get_status.assert_called_once()
        assert 'running' in result
        assert 'last_sync_time' in result
        assert 'registered_platforms' in result
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_get_sync_history(self, mock_get_engine):
        """Test get_sync_history task."""
        # Configure mock
        mock_engine = Mock()
        mock_engine.get_history.return_value = [
            {
                'status': 'success',
                'sync_type': 'products',
                'start_time': datetime.now().isoformat(),
                'end_time': datetime.now().isoformat(),
                'duration': 1.5
            }
        ]
        mock_get_engine.return_value = mock_engine
        
        # Run task
        result = get_sync_history()
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.get_history.assert_called_once()
        assert len(result) == 1
        assert result[0]['status'] == 'success'
    
    @patch('src.sync.tasks.shopify_sync_tasks.get_sync_engine')
    def test_get_sync_history_with_limit(self, mock_get_engine):
        """Test get_sync_history task with limit parameter."""
        # Configure mock
        mock_engine = Mock()
        history = [
            {
                'status': 'success',
                'sync_type': 'products',
                'start_time': datetime.now().isoformat(),
                'end_time': datetime.now().isoformat(),
                'duration': 1.5
            },
            {
                'status': 'success',
                'sync_type': 'inventory',
                'start_time': datetime.now().isoformat(),
                'end_time': datetime.now().isoformat(),
                'duration': 0.5
            }
        ]
        mock_engine.get_history.return_value = history
        mock_get_engine.return_value = mock_engine
        
        # Run task with limit=1
        result = get_sync_history(limit=1)
        
        # Verify
        mock_get_engine.assert_called_once()
        mock_engine.get_history.assert_called_once()
        # Function should return just the last history item
        assert len(result) == 1
        assert result[0] == history[-1]