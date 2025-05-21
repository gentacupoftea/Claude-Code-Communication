"""Test fixtures for Shopify Sync Engine tests."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import asyncio
from datetime import datetime
from typing import Dict, Any, List

from src.sync.sync_engine.models import SyncType, SyncStatus, SyncResult, SyncHistory
from src.sync.shopify_sync import ShopifySyncEngine


@pytest.fixture
def mock_shopify_api():
    """Mock Shopify API."""
    mock = Mock()
    
    # Mock product data
    mock.get_products.return_value = [
        {
            "id": "prod_1",
            "title": "Test Product 1",
            "vendor": "Test Vendor",
            "price": "29.99",
            "inventory_quantity": 100
        },
        {
            "id": "prod_2",
            "title": "Test Product 2",
            "vendor": "Test Vendor",
            "price": "49.99",
            "inventory_quantity": 50
        }
    ]
    
    # Mock inventory data
    mock.get_inventory_levels.return_value = [
        {
            "inventory_item_id": "inv_1",
            "location_id": "loc_1",
            "available": 100
        },
        {
            "inventory_item_id": "inv_2",
            "location_id": "loc_1",
            "available": 50
        }
    ]
    
    # Mock customer data
    mock.get_customers.return_value = [
        {
            "id": "cust_1",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "Customer"
        }
    ]
    
    return mock


@pytest.fixture
def mock_external_api():
    """Mock External API client."""
    mock = Mock()
    
    # Mock sync methods
    mock.sync_products = Mock(return_value={"status": "success", "count": 2})
    mock.sync_inventory = Mock(return_value={"status": "success", "count": 2})
    mock.sync_customers = Mock(return_value={"status": "success", "count": 1})
    
    # Mock order retrieval
    mock.get_orders = Mock(return_value=[
        {
            "id": "ext_order_1",
            "customer_id": "ext_cust_1",
            "order_date": datetime.now().isoformat(),
            "total": 100.0
        }
    ])
    
    # Mock async initialization
    mock.initialize = AsyncMock(return_value=True)
    
    return mock


@pytest.fixture
def sync_engine(mock_shopify_api, mock_external_api):
    """Create a ShopifySyncEngine instance with mocked dependencies."""
    engine = ShopifySyncEngine(shopify_api=mock_shopify_api)
    engine.register_external_api("test_platform", mock_external_api)
    return engine


@pytest.fixture
def sample_sync_result():
    """Create a sample SyncResult."""
    result = SyncResult(
        status=SyncStatus.SUCCESS,
        sync_type=SyncType.FULL,
        synced_count=10,
        failed_count=0,
        skipped_count=2,
        start_time=datetime.now()
    )
    result.end_time = datetime.now()
    result.update_duration()
    return result


@pytest.fixture
def sample_sync_history():
    """Create a sample SyncHistory with multiple results."""
    history = SyncHistory()
    
    # Add multiple results of different types
    for sync_type in [SyncType.PRODUCTS, SyncType.INVENTORY, SyncType.ORDERS, SyncType.CUSTOMERS, SyncType.FULL]:
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=sync_type,
            synced_count=5,
            failed_count=0,
            skipped_count=1,
            start_time=datetime.now()
        )
        result.end_time = datetime.now()
        result.update_duration()
        history.add_result(result)
    
    # Add a failed result
    failed_result = SyncResult(
        status=SyncStatus.FAILED,
        sync_type=SyncType.PRODUCTS,
        synced_count=0,
        failed_count=3,
        skipped_count=0,
        start_time=datetime.now()
    )
    failed_result.end_time = datetime.now()
    failed_result.update_duration()
    history.add_result(failed_result)
    
    return history