"""
Tests for sync engine models.
"""

import pytest
import json
from datetime import datetime, timedelta

from src.sync.sync_engine.models import (
    SyncStatus,
    SyncType,
    SyncRecord,
    SyncResult,
    SyncHistory
)


class TestSyncModels:
    """Test class for sync engine models."""
    
    def test_sync_status_enum(self):
        """Test SyncStatus enum."""
        assert SyncStatus.SUCCESS.value == "success"
        assert SyncStatus.PARTIAL.value == "partial"
        assert SyncStatus.FAILED.value == "failed"
        assert SyncStatus.RUNNING.value == "running"
        assert SyncStatus.PENDING.value == "pending"
        assert SyncStatus.CANCELLED.value == "cancelled"
    
    def test_sync_type_enum(self):
        """Test SyncType enum."""
        assert SyncType.PRODUCTS.value == "products"
        assert SyncType.INVENTORY.value == "inventory"
        assert SyncType.ORDERS.value == "orders"
        assert SyncType.CUSTOMERS.value == "customers"
        assert SyncType.FULL.value == "full"
    
    def test_sync_record_creation(self):
        """Test SyncRecord creation."""
        record = SyncRecord(
            id="prod_1",
            source_platform="shopify",
            target_platform="ext_platform",
            sync_type=SyncType.PRODUCTS,
            status=SyncStatus.SUCCESS
        )
        
        assert record.id == "prod_1"
        assert record.source_platform == "shopify"
        assert record.target_platform == "ext_platform"
        assert record.sync_type == SyncType.PRODUCTS
        assert record.status == SyncStatus.SUCCESS
        assert isinstance(record.timestamp, datetime)
        assert isinstance(record.details, dict)
        assert record.error is None
    
    def test_sync_record_with_details(self):
        """Test SyncRecord with details."""
        details = {"price": "29.99", "quantity": 100}
        record = SyncRecord(
            id="prod_1",
            source_platform="shopify",
            target_platform="ext_platform",
            sync_type=SyncType.PRODUCTS,
            status=SyncStatus.SUCCESS,
            details=details
        )
        
        assert record.details == details
    
    def test_sync_record_with_error(self):
        """Test SyncRecord with error."""
        error_msg = "Failed to sync product"
        record = SyncRecord(
            id="prod_1",
            source_platform="shopify",
            target_platform="ext_platform",
            sync_type=SyncType.PRODUCTS,
            status=SyncStatus.FAILED,
            error=error_msg
        )
        
        assert record.status == SyncStatus.FAILED
        assert record.error == error_msg
    
    def test_sync_result_creation(self):
        """Test SyncResult creation."""
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        
        assert result.status == SyncStatus.SUCCESS
        assert result.sync_type == SyncType.PRODUCTS
        assert result.synced_count == 0
        assert result.failed_count == 0
        assert result.skipped_count == 0
        assert isinstance(result.errors, list)
        assert isinstance(result.warnings, list)
        assert isinstance(result.start_time, datetime)
        assert result.end_time is None
        assert result.duration == 0.0
        assert isinstance(result.records, list)
    
    def test_sync_result_is_success(self):
        """Test SyncResult is_success method."""
        # Success case
        success_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        assert success_result.is_success() is True
        
        # Partial success
        partial_result = SyncResult(
            status=SyncStatus.PARTIAL,
            sync_type=SyncType.PRODUCTS
        )
        assert partial_result.is_success() is True
        
        # Failed but no failed items
        failed_result = SyncResult(
            status=SyncStatus.FAILED,
            sync_type=SyncType.PRODUCTS
        )
        assert failed_result.is_success() is False
        
        # Success but with failed items
        mixed_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            failed_count=1
        )
        assert mixed_result.is_success() is False
    
    def test_sync_result_to_dict(self):
        """Test SyncResult to_dict method."""
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            synced_count=10,
            failed_count=2,
            skipped_count=1
        )
        result.end_time = datetime.now()
        result.update_duration()
        
        result_dict = result.to_dict()
        
        assert result_dict['status'] == SyncStatus.SUCCESS.value
        assert result_dict['sync_type'] == SyncType.PRODUCTS.value
        assert result_dict['synced_count'] == 10
        assert result_dict['failed_count'] == 2
        assert result_dict['skipped_count'] == 1
        assert isinstance(result_dict['start_time'], str)
        assert isinstance(result_dict['end_time'], str)
        assert result_dict['duration'] > 0
        assert 'success_ratio' in result_dict
    
    def test_sync_result_to_json(self):
        """Test SyncResult to_json method."""
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            synced_count=10
        )
        result.end_time = datetime.now()
        result.update_duration()
        
        json_str = result.to_json()
        
        # Ensure it's valid JSON
        parsed = json.loads(json_str)
        assert parsed['status'] == SyncStatus.SUCCESS.value
        assert parsed['sync_type'] == SyncType.PRODUCTS.value
        assert parsed['synced_count'] == 10
    
    def test_sync_result_update_duration(self):
        """Test SyncResult update_duration method."""
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        
        # Set start time to 1 second ago
        result.start_time = datetime.now() - timedelta(seconds=1)
        
        # Update duration
        result.update_duration()
        
        assert result.end_time is not None
        assert result.duration >= 1.0  # Should be at least 1 second
    
    def test_sync_result_add_record(self):
        """Test SyncResult add_record method."""
        result = SyncResult(
            status=SyncStatus.RUNNING,
            sync_type=SyncType.PRODUCTS
        )
        
        # Create and add a success record
        success_record = SyncRecord(
            id="prod_1",
            source_platform="shopify",
            target_platform="ext_platform",
            sync_type=SyncType.PRODUCTS,
            status=SyncStatus.SUCCESS
        )
        result.add_record(success_record)
        
        # Create and add a failed record
        error_msg = "Failed to sync"
        failed_record = SyncRecord(
            id="prod_2",
            source_platform="shopify",
            target_platform="ext_platform",
            sync_type=SyncType.PRODUCTS,
            status=SyncStatus.FAILED,
            error=error_msg
        )
        result.add_record(failed_record)
        
        # Check counts and errors
        assert result.synced_count == 1
        assert result.failed_count == 1
        assert len(result.errors) == 1
        assert result.errors[0] == error_msg
    
    def test_sync_history_creation(self):
        """Test SyncHistory creation."""
        history = SyncHistory()
        
        assert isinstance(history.results, list)
        assert len(history.results) == 0
        assert history.max_size == 100
    
    def test_sync_history_add_result(self):
        """Test SyncHistory add_result method."""
        history = SyncHistory()
        
        # Add a result
        result1 = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        history.add_result(result1)
        
        assert len(history.results) == 1
        assert history.results[0] == result1
        
        # Add another result
        result2 = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.INVENTORY
        )
        history.add_result(result2)
        
        assert len(history.results) == 2
        assert history.results[1] == result2
    
    def test_sync_history_max_size(self):
        """Test SyncHistory max_size enforcement."""
        # Create history with small max_size
        history = SyncHistory(max_size=3)
        
        # Add 4 results (exceeding max_size)
        for i in range(4):
            result = SyncResult(
                status=SyncStatus.SUCCESS,
                sync_type=SyncType.PRODUCTS
            )
            history.add_result(result)
        
        # Should only keep the 3 most recent
        assert len(history.results) == 3
    
    def test_sync_history_get_latest(self):
        """Test SyncHistory get_latest method."""
        history = SyncHistory()
        
        # Add multiple results of different types
        products_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        history.add_result(products_result)
        
        inventory_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.INVENTORY
        )
        history.add_result(inventory_result)
        
        orders_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.ORDERS
        )
        history.add_result(orders_result)
        
        # Test with no filter
        latest = history.get_latest()
        assert latest == orders_result
        
        # Test with type filter
        latest_products = history.get_latest(sync_type=SyncType.PRODUCTS)
        assert latest_products == products_result
        
        # Test with type that doesn't exist
        latest_customers = history.get_latest(sync_type=SyncType.CUSTOMERS)
        assert latest_customers is None
        
        # Test with empty history
        empty_history = SyncHistory()
        assert empty_history.get_latest() is None
    
    def test_sync_history_get_success_rate(self):
        """Test SyncHistory get_success_rate method."""
        history = SyncHistory()
        
        # Add results with mixed success/failure
        result1 = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            synced_count=8,
            failed_count=2
        )
        history.add_result(result1)
        
        result2 = SyncResult(
            status=SyncStatus.PARTIAL,
            sync_type=SyncType.INVENTORY,
            synced_count=5,
            failed_count=5
        )
        history.add_result(result2)
        
        # Overall success rate
        success_rate = history.get_success_rate()
        assert success_rate == 13 / 20  # (8+5)/(8+2+5+5)
        
        # Success rate for specific type
        products_rate = history.get_success_rate(sync_type=SyncType.PRODUCTS)
        assert products_rate == 8 / 10
        
        # Test with empty history
        empty_history = SyncHistory()
        assert empty_history.get_success_rate() == 0.0
        
        # Test with no successes or failures
        no_data_result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS
        )
        no_data_history = SyncHistory()
        no_data_history.add_result(no_data_result)
        assert no_data_history.get_success_rate() == 0.0
    
    def test_sync_history_to_dict(self):
        """Test SyncHistory to_dict method."""
        history = SyncHistory()
        
        # Add a result
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            synced_count=10,
            failed_count=0
        )
        result.end_time = datetime.now()
        result.update_duration()
        history.add_result(result)
        
        # Convert to dict
        history_dict = history.to_dict()
        
        assert 'results' in history_dict
        assert 'total_count' in history_dict
        assert 'success_rate' in history_dict
        assert history_dict['total_count'] == 1
        assert history_dict['success_rate'] == 1.0
        assert len(history_dict['results']) == 1
    
    def test_sync_history_to_json(self):
        """Test SyncHistory to_json method."""
        history = SyncHistory()
        
        # Add a result
        result = SyncResult(
            status=SyncStatus.SUCCESS,
            sync_type=SyncType.PRODUCTS,
            synced_count=10
        )
        result.end_time = datetime.now()
        result.update_duration()
        history.add_result(result)
        
        json_str = history.to_json()
        
        # Ensure it's valid JSON
        parsed = json.loads(json_str)
        assert 'results' in parsed
        assert 'total_count' in parsed
        assert 'success_rate' in parsed