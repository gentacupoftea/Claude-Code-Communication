"""
Tests for the MCP server REST API endpoints.
Tests the API endpoints to verify they handle requests correctly and return
appropriate responses.
"""
import os
import sys
import json
import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.main import APIServer
from src.config_manager import ConfigManager
from src.cache.cache_manager import CacheManager
from src.sync.sync_manager import SyncManager


@pytest.fixture
def mock_config():
    """Create a mock configuration manager."""
    config = Mock(spec=ConfigManager)
    config.get.return_value = True  # Enable all features
    config.get_config.return_value = {
        "server": {
            "host": "127.0.0.1",
            "port": 8765,
        },
        "enable_analytics": True,
        "enable_sync": True,
        "log_level": "INFO"
    }
    return config


@pytest.fixture
def mock_cache_manager():
    """Create a mock cache manager."""
    cache_manager = Mock(spec=CacheManager)
    cache_manager.get.return_value = None
    cache_manager.get_stats.return_value = {
        "hits": 10,
        "misses": 5,
        "hit_rate": 0.67,
        "size": 15,
        "memory_usage": 10240
    }
    cache_manager.get_metrics.return_value = {
        "cache_size": 15,
        "hit_rate": 0.67,
        "memory_usage_kb": 10
    }
    return cache_manager


@pytest.fixture
def mock_sync_manager():
    """Create a mock sync manager."""
    sync_manager = Mock(spec=SyncManager)
    sync_manager.get_status.return_value = {
        "running": False,
        "last_sync_time": "2025-05-21T10:00:00Z",
        "registered_platforms": ["shopify", "rakuten"],
        "latest_syncs": {
            "products": {"status": "success", "count": 100, "timestamp": "2025-05-21T09:30:00Z"},
            "orders": {"status": "success", "count": 50, "timestamp": "2025-05-21T09:35:00Z"},
            "customers": {"status": "success", "count": 25, "timestamp": "2025-05-21T09:40:00Z"}
        }
    }
    sync_manager.get_platforms.return_value = ["shopify", "rakuten"]
    sync_manager.get_metrics.return_value = {
        "total_syncs": 10,
        "success_rate": 0.9,
        "average_duration": 5.2,
        "synced_entities": {
            "products": 1000,
            "orders": 500,
            "customers": 250
        }
    }
    sync_manager.trigger_sync.return_value = "task123"
    return sync_manager


@pytest.fixture
def test_client(mock_config, mock_cache_manager, mock_sync_manager):
    """Create a test client for the API."""
    server = APIServer(
        host="127.0.0.1",
        port=8765,
        config=mock_config,
        cache_manager=mock_cache_manager,
        sync_manager=mock_sync_manager
    )
    
    # Create TestClient
    client = TestClient(server.app)
    return client


class TestHealthEndpoint:
    """Tests for the health endpoint."""
    
    def test_health_check_basic(self, test_client):
        """Test basic health check without details."""
        response = test_client.get("/api/v1/health")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "timestamp" in data
        assert "components" in data
        assert data["components"]["cache"] is True
        assert data["components"]["sync"] is True
        
        # Detailed fields should not be present
        assert "cache_stats" not in data
        assert "sync_status" not in data

    def test_health_check_detailed(self, test_client, mock_cache_manager, mock_sync_manager):
        """Test detailed health check."""
        response = test_client.get("/api/v1/health?detailed=true")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "timestamp" in data
        assert "components" in data
        assert "cache_stats" in data
        assert "sync_status" in data
        
        # Check that cache stats are included
        assert data["cache_stats"] == mock_cache_manager.get_stats.return_value
        
        # Check that sync status is included
        assert data["sync_status"] == mock_sync_manager.get_status.return_value


class TestMetricsEndpoint:
    """Tests for the metrics endpoint."""
    
    def test_get_metrics(self, test_client, mock_cache_manager, mock_sync_manager):
        """Test getting metrics."""
        response = test_client.get("/api/v1/metrics")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "timestamp" in data
        assert "version" in data
        assert "cache" in data
        assert "sync" in data
        
        # Check that cache metrics are included
        assert data["cache"] == mock_cache_manager.get_metrics.return_value
        
        # Check that sync metrics are included
        assert data["sync"] == mock_sync_manager.get_metrics.return_value


class TestAnalyticsEndpoints:
    """Tests for the analytics endpoints."""
    
    def test_get_orders_analytics_no_cache(self, test_client, mock_cache_manager):
        """Test getting order analytics when there's no cache hit."""
        # Configure mock to return None (cache miss)
        mock_cache_manager.get.return_value = None
        
        response = test_client.get("/api/v1/analytics/orders?days=30&format=detailed&include_charts=true")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "total_orders" in data
        assert "total_revenue" in data
        assert "average_order_value" in data
        assert "charts" in data
        
        # Verify cache interaction
        cache_key = "api_orders_analytics_30_detailed_True"
        mock_cache_manager.get.assert_called_once_with(cache_key)
        mock_cache_manager.set.assert_called_once()

    def test_get_orders_analytics_from_cache(self, test_client, mock_cache_manager):
        """Test getting order analytics from cache."""
        # Configure mock to return cached data
        cached_data = {
            "total_orders": 100,
            "total_revenue": 10000.0,
            "average_order_value": 100.0,
            "days": 30,
            "format": "detailed",
            "charts": {
                "daily_sales": {
                    "type": "line",
                    "data": {
                        "labels": ["Day 1", "Day 2", "Day 3"],
                        "datasets": [{
                            "label": "Sales",
                            "data": [100, 150, 120]
                        }]
                    }
                }
            }
        }
        mock_cache_manager.get.return_value = cached_data
        
        response = test_client.get("/api/v1/analytics/orders?days=30&format=detailed&include_charts=true")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data == cached_data
        
        # Verify cache interaction
        cache_key = "api_orders_analytics_30_detailed_True"
        mock_cache_manager.get.assert_called_once_with(cache_key)
        mock_cache_manager.set.assert_not_called()


class TestSyncEndpoints:
    """Tests for the synchronization endpoints."""
    
    def test_get_sync_status(self, test_client, mock_sync_manager):
        """Test getting sync status."""
        response = test_client.get("/api/v1/sync/status")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data == mock_sync_manager.get_status.return_value

    def test_get_sync_platforms(self, test_client, mock_sync_manager):
        """Test getting available sync platforms."""
        response = test_client.get("/api/v1/sync/platforms")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data == mock_sync_manager.get_platforms.return_value

    def test_trigger_sync_valid(self, test_client, mock_sync_manager):
        """Test triggering a sync with valid parameters."""
        request_data = {
            "platform": "shopify",
            "entity_type": "products",
            "force": True,
            "params": {
                "limit": 100,
                "updated_at_min": "2025-05-01T00:00:00Z"
            }
        }
        
        response = test_client.post(
            "/api/v1/sync/trigger",
            json=request_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "scheduled"
        assert data["task_id"] == "task123"
        assert "message" in data
        
        # Verify sync manager interaction
        mock_sync_manager.trigger_sync.assert_called_once_with(
            platform="shopify",
            entity_type="products",
            force=True,
            params=request_data["params"]
        )

    def test_trigger_sync_invalid_platform(self, test_client, mock_sync_manager):
        """Test triggering a sync with an invalid platform."""
        # Configure mock to return a specific list of platforms
        mock_sync_manager.get_platforms.return_value = ["shopify", "rakuten"]
        
        request_data = {
            "platform": "invalid_platform",
            "entity_type": "products",
            "force": False
        }
        
        response = test_client.post(
            "/api/v1/sync/trigger",
            json=request_data
        )
        
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "Unknown platform" in data["detail"]

    def test_trigger_sync_invalid_entity_type(self, test_client):
        """Test triggering a sync with an invalid entity type."""
        request_data = {
            "platform": "shopify",
            "entity_type": "invalid_type",
            "force": False
        }
        
        response = test_client.post(
            "/api/v1/sync/trigger",
            json=request_data
        )
        
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "Unknown entity type" in data["detail"]


class TestErrorHandling:
    """Tests for API error handling."""
    
    def test_not_found(self, test_client):
        """Test requesting a non-existent endpoint."""
        response = test_client.get("/api/v1/nonexistent")
        
        assert response.status_code == 404

    def test_method_not_allowed(self, test_client):
        """Test using an incorrect HTTP method."""
        response = test_client.post("/api/v1/health")
        
        assert response.status_code == 405

    def test_internal_server_error(self, test_client, mock_sync_manager):
        """Test handling of internal server errors."""
        # Configure sync manager to raise an exception
        mock_sync_manager.get_status.side_effect = Exception("Internal error")
        
        response = test_client.get("/api/v1/sync/status")
        
        # FastAPI test client will convert internal errors to 500 responses
        assert response.status_code == 500