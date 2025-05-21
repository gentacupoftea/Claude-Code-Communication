"""
Tests for the MCP server initialization and startup.
Tests the server's ability to load configuration, initialize components,
and start listening for connections correctly.
"""
import os
import sys
import pytest
import asyncio
import threading
import time
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.main import APIServer, start_api_server
from src.config_manager import ConfigManager
from src.cache.cache_manager import CacheManager
from src.sync.sync_manager import SyncManager


@pytest.fixture
def mock_config():
    """Create a mock configuration manager."""
    config = Mock(spec=ConfigManager)
    config.get.return_value = {}
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
        "hits": 0,
        "misses": 0,
        "hit_rate": 0,
        "size": 0,
        "memory_usage": 0
    }
    cache_manager.get_metrics.return_value = {
        "cache_size": 0,
        "hit_rate": 0
    }
    return cache_manager


@pytest.fixture
def mock_sync_manager():
    """Create a mock sync manager."""
    sync_manager = Mock(spec=SyncManager)
    sync_manager.get_status.return_value = {
        "running": False,
        "last_sync_time": None,
        "registered_platforms": ["shopify", "rakuten"],
        "latest_syncs": {}
    }
    sync_manager.get_platforms.return_value = ["shopify", "rakuten"]
    sync_manager.get_metrics.return_value = {
        "total_syncs": 0,
        "success_rate": 0
    }
    sync_manager.trigger_sync.return_value = "task123"
    return sync_manager


class TestServerInitialization:
    """Test class for server initialization."""
    
    def test_create_api_server(self, mock_config, mock_cache_manager, mock_sync_manager):
        """Test creating an API server instance."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        assert server.host == "127.0.0.1"
        assert server.port == 8765
        assert server.config == mock_config
        assert server.cache_manager == mock_cache_manager
        assert server.sync_manager == mock_sync_manager
        assert server.running is False
        assert server.app is not None

    def test_server_api_endpoints(self, mock_config, mock_cache_manager, mock_sync_manager):
        """Test that API endpoints are correctly added to the server."""
        server = APIServer(
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        # Check that FastAPI routes are correctly set up
        assert any(route.path == "/api/v1/health" for route in server.app.routes)
        assert any(route.path == "/api/v1/metrics" for route in server.app.routes)
        
        # With enabled analytics
        mock_config.get.return_value = True
        assert any(route.path == "/api/v1/analytics/orders" for route in server.app.routes)
        
        # With sync manager
        assert any(route.path == "/api/v1/sync/status" for route in server.app.routes)
        assert any(route.path == "/api/v1/sync/platforms" for route in server.app.routes)
        assert any(route.path == "/api/v1/sync/trigger" for route in server.app.routes)

    @patch('uvicorn.run')
    def test_server_start(self, mock_uvicorn_run, mock_config, mock_cache_manager, mock_sync_manager):
        """Test starting the server."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        server.start()
        
        # Check that server is marked as running
        assert server.running is True
        
        # Check that uvicorn.run was called with correct parameters
        mock_uvicorn_run.assert_called_once_with(server.app, host="127.0.0.1", port=8765)

    @patch('uvicorn.run')
    def test_server_start_already_running(self, mock_uvicorn_run, mock_config, mock_cache_manager, mock_sync_manager):
        """Test starting the server when it's already running."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        # Set running status
        server.running = True
        
        # Try to start again
        server.start()
        
        # Check that uvicorn.run was not called
        mock_uvicorn_run.assert_not_called()

    def test_server_shutdown(self, mock_config, mock_cache_manager, mock_sync_manager):
        """Test shutting down the server."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        # Set running status
        server.running = True
        
        # Shutdown
        server.shutdown()
        
        # Check that server is marked as not running
        assert server.running is False

    def test_start_api_server_function(self, mock_config, mock_cache_manager, mock_sync_manager):
        """Test the start_api_server function."""
        server = start_api_server(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        assert isinstance(server, APIServer)
        assert server.host == "127.0.0.1"
        assert server.port == 8765
        assert server.config == mock_config
        assert server.cache_manager == mock_cache_manager
        assert server.sync_manager == mock_sync_manager

    @patch('src.auth.database.init_db')
    async def test_lifespan_management(self, mock_init_db, mock_config, mock_cache_manager, mock_sync_manager):
        """Test the lifespan context manager for startup and shutdown."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        # Get lifespan context manager from app
        for middleware in server.app.middleware:
            if hasattr(middleware, "lifespan"):
                lifespan = middleware.lifespan
                break
        
        # Create a mock app for testing lifespan
        mock_app = MagicMock()
        
        # Use lifespan context manager
        async with lifespan(mock_app) as app:
            # Check that database initialization was called
            mock_init_db.assert_called_once()
        
        # Check that cleanup was performed
        mock_cache_manager.shutdown.assert_called_once()
        mock_sync_manager.stop.assert_called_once()


class TestServerPerformance:
    """Performance tests for the server."""
    
    @pytest.mark.skipif(
        os.environ.get("RUN_PERFORMANCE_TESTS") != "1",
        reason="Performance tests are skipped by default"
    )
    def test_server_startup_time(self, mock_config):
        """Test the time it takes to start up the server."""
        start_time = time.time()
        
        # Create server with minimal configuration
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config
        )
        
        end_time = time.time()
        startup_time = end_time - start_time
        
        # Server should start in under 1 second
        assert startup_time < 1.0, f"Server startup took {startup_time} seconds, which is too slow"

    @pytest.mark.skipif(
        os.environ.get("RUN_PERFORMANCE_TESTS") != "1",
        reason="Performance tests are skipped by default"
    )
    def test_health_endpoint_performance(self, mock_config, mock_cache_manager, mock_sync_manager):
        """Test the performance of the health endpoint."""
        server = APIServer(
            host="127.0.0.1",
            port=8765,
            config=mock_config,
            cache_manager=mock_cache_manager,
            sync_manager=mock_sync_manager
        )
        
        # Get the health endpoint handler
        health_route = next(route for route in server.app.routes if route.path == "/api/v1/health")
        health_handler = health_route.endpoint
        
        # Time the health endpoint
        start_time = time.time()
        result = asyncio.run(health_handler(detailed=True))
        end_time = time.time()
        
        response_time = end_time - start_time
        
        # Health endpoint should respond in under 50ms
        assert response_time < 0.05, f"Health endpoint took {response_time} seconds, which is too slow"
        
        # Check that response includes expected fields
        assert "status" in result
        assert "version" in result
        assert "timestamp" in result
        assert "components" in result
        assert "cache_stats" in result
        assert "sync_status" in result