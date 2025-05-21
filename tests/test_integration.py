"""
Integration tests for the MCP server.
Tests multiple components working together to verify system-level functionality.
"""
import os
import sys
import time
import json
import pytest
import threading
import requests
from unittest.mock import patch, Mock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.main import start_api_server
from src.config_manager import ConfigManager
from src.cache.cache_manager import CacheManager
from src.sync.sync_manager import SyncManager
from src.auth.models import User
from src.auth.database import init_db, get_db


# Skip real HTTP tests by default (these will be run in CI with special env vars)
pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1",
    reason="Integration tests with real HTTP are skipped by default"
)


@pytest.fixture
def mock_config():
    """Create a ConfigManager with test settings."""
    config = ConfigManager()
    # Override config with test values
    config._config = {
        "server": {
            "host": "127.0.0.1",
            "port": 8766,  # Use a different port for tests
        },
        "enable_analytics": True,
        "enable_sync": True,
        "log_level": "INFO",
        "auth": {
            "secret_key": "test_secret_key_for_jwt",
            "algorithm": "HS256",
            "access_token_expire_minutes": 30
        }
    }
    return config


@pytest.fixture
def server_url():
    """Return the server URL for tests."""
    return "http://127.0.0.1:8766"


@pytest.fixture
def server_thread(mock_config):
    """Start a server in a separate thread for integration tests."""
    # Initialize real cache and sync managers for integration testing
    cache_manager = CacheManager()
    sync_manager = SyncManager(config=mock_config)
    
    # Start the server in a thread
    server = start_api_server(
        host="127.0.0.1",
        port=8766,
        config=mock_config,
        cache_manager=cache_manager,
        sync_manager=sync_manager
    )
    
    # Create a thread for the server
    server_thread = threading.Thread(target=server.start)
    server_thread.daemon = True
    server_thread.start()
    
    # Give the server time to start
    time.sleep(1)
    
    yield server
    
    # Shutdown the server
    server.running = False


@pytest.fixture
def test_user():
    """Create a test user in the database."""
    # Initialize database
    init_db()
    
    # Create a test user
    db = next(get_db())
    user = User(
        username="testuser",
        email="test@example.com",
        full_name="Test User"
    )
    user.set_password("password123")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == "testuser").first()
    if not existing_user:
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = existing_user
    
    return user


@pytest.fixture
def auth_headers(server_url, test_user):
    """Get authentication headers by logging in."""
    # Login to get token
    login_data = {
        "username": "testuser",
        "password": "password123"
    }
    response = requests.post(f"{server_url}/auth/token", data=login_data)
    token_data = response.json()
    
    # Return auth headers
    return {"Authorization": f"Bearer {token_data['access_token']}"}


class TestServerIntegration:
    """Integration tests for server startup and basic functionality."""
    
    def test_server_startup(self, server_thread, server_url):
        """Test that the server starts up correctly."""
        # Try to connect to the server
        response = requests.get(f"{server_url}/api/v1/health")
        
        # Check that the server is responding
        assert response.status_code == 200
        
        # Check response content
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "timestamp" in data
        assert "components" in data

    def test_authentication_flow(self, server_thread, server_url, test_user):
        """Test the full authentication flow."""
        # 1. Try to access a protected endpoint without authentication
        response = requests.get(f"{server_url}/api/v1/sync/status")
        assert response.status_code == 401  # Unauthorized
        
        # 2. Login with correct credentials
        login_data = {
            "username": "testuser",
            "password": "password123"
        }
        response = requests.post(f"{server_url}/auth/token", data=login_data)
        assert response.status_code == 200
        
        token_data = response.json()
        assert "access_token" in token_data
        assert "token_type" in token_data
        
        # 3. Access protected endpoint with token
        headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        response = requests.get(f"{server_url}/api/v1/sync/status", headers=headers)
        assert response.status_code == 200
        
        # 4. Try to login with incorrect credentials
        login_data = {
            "username": "testuser",
            "password": "wrongpassword"
        }
        response = requests.post(f"{server_url}/auth/token", data=login_data)
        assert response.status_code == 401


class TestCacheIntegration:
    """Integration tests for cache functionality."""
    
    def test_cache_hit(self, server_thread, server_url, auth_headers):
        """Test that cache is working correctly across requests."""
        # Make a first request to an endpoint that uses cache
        response1 = requests.get(
            f"{server_url}/api/v1/analytics/orders",
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Record the response and make the same request again
        data1 = response1.json()
        
        # Make the same request again
        response2 = requests.get(
            f"{server_url}/api/v1/analytics/orders",
            headers=auth_headers
        )
        assert response2.status_code == 200
        
        data2 = response2.json()
        
        # The responses should be identical (from cache)
        assert data1 == data2
        
        # Check cache statistics
        response = requests.get(f"{server_url}/api/v1/metrics", headers=auth_headers)
        metrics = response.json()
        
        # Cache hit rate should be greater than 0
        assert metrics["cache"]["hit_rate"] > 0


class TestSyncIntegration:
    """Integration tests for sync functionality."""
    
    def test_trigger_sync_flow(self, server_thread, server_url, auth_headers):
        """Test the sync triggering and status checking flow."""
        # 1. Check available platforms
        response = requests.get(
            f"{server_url}/api/v1/sync/platforms",
            headers=auth_headers
        )
        assert response.status_code == 200
        platforms = response.json()
        
        # We should have at least one platform
        assert len(platforms) > 0
        
        # 2. Trigger a sync
        sync_data = {
            "platform": platforms[0],  # Use the first available platform
            "entity_type": "products",
            "force": True,
            "params": {
                "limit": 10
            }
        }
        
        response = requests.post(
            f"{server_url}/api/v1/sync/trigger",
            json=sync_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        
        sync_result = response.json()
        assert sync_result["status"] == "scheduled"
        assert "task_id" in sync_result
        
        # 3. Check sync status
        time.sleep(1)  # Give the sync a moment to start/complete
        
        response = requests.get(
            f"{server_url}/api/v1/sync/status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        status = response.json()
        assert "registered_platforms" in status
        assert platforms[0] in status["registered_platforms"]


class TestEndToEndFlow:
    """End-to-end tests that simulate real user flows."""
    
    def test_analytics_data_flow(self, server_thread, server_url, auth_headers):
        """Test the complete analytics data flow."""
        # 1. Trigger a sync to ensure we have data
        sync_data = {
            "platform": "shopify",
            "entity_type": "orders",
            "force": True
        }
        
        response = requests.post(
            f"{server_url}/api/v1/sync/trigger",
            json=sync_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Wait for sync to complete
        time.sleep(2)
        
        # 2. Request analytics data
        response = requests.get(
            f"{server_url}/api/v1/analytics/orders?days=30&include_charts=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_orders" in data
        assert "total_revenue" in data
        assert "average_order_value" in data
        
        # 3. Check that we have chart data
        assert "charts" in data
        assert "daily_sales" in data["charts"]
        
        # 4. Verify data is properly cached by checking metrics
        response = requests.get(
            f"{server_url}/api/v1/metrics",
            headers=auth_headers
        )
        metrics = response.json()
        
        assert "cache" in metrics
        assert metrics["cache"]["cache_size"] > 0

    def test_server_resilience(self, server_thread, server_url):
        """Test server resilience against malformed requests."""
        # 1. Send malformed JSON
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            f"{server_url}/api/v1/sync/trigger",
            data="this is not valid JSON",
            headers=headers
        )
        assert response.status_code == 422  # Unprocessable Entity
        
        # 2. Send request with missing required fields
        response = requests.post(
            f"{server_url}/api/v1/sync/trigger",
            json={"platform": "shopify"},  # Missing entity_type
            headers=headers
        )
        assert response.status_code == 422  # Unprocessable Entity
        
        # 3. Send request with invalid parameter types
        response = requests.get(
            f"{server_url}/api/v1/analytics/orders?days=not_a_number",
            headers=headers
        )
        assert response.status_code == 422  # Unprocessable Entity


class TestPerformance:
    """Performance tests for the server."""
    
    @pytest.mark.skipif(
        os.environ.get("RUN_PERFORMANCE_TESTS") != "1",
        reason="Performance tests are skipped by default"
    )
    def test_response_time(self, server_thread, server_url, auth_headers):
        """Test response time for key endpoints."""
        endpoints = [
            "/api/v1/health",
            "/api/v1/metrics",
            "/api/v1/sync/status",
            "/api/v1/sync/platforms",
            "/api/v1/analytics/orders?days=30"
        ]
        
        results = {}
        
        for endpoint in endpoints:
            # Make a request and measure time
            start_time = time.time()
            response = requests.get(
                f"{server_url}{endpoint}",
                headers=auth_headers
            )
            end_time = time.time()
            
            # Calculate response time
            response_time = end_time - start_time
            results[endpoint] = {
                "status_code": response.status_code,
                "response_time": response_time
            }
            
            # Assert on response time - should be under 1 second
            assert response_time < 1.0, f"Response time for {endpoint} is too slow: {response_time} seconds"
        
        # Log results for review
        print("\nPerformance Test Results:")
        for endpoint, data in results.items():
            print(f"{endpoint}: {data['response_time']:.3f} seconds")
    
    @pytest.mark.skipif(
        os.environ.get("RUN_PERFORMANCE_TESTS") != "1",
        reason="Performance tests are skipped by default"
    )
    def test_concurrent_requests(self, server_thread, server_url, auth_headers):
        """Test server performance with concurrent requests."""
        import concurrent.futures
        
        def make_request(endpoint):
            """Make a request to the server."""
            try:
                response = requests.get(
                    f"{server_url}{endpoint}",
                    headers=auth_headers,
                    timeout=5
                )
                return {
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "success": 200 <= response.status_code < 300
                }
            except Exception as e:
                return {
                    "endpoint": endpoint,
                    "error": str(e),
                    "success": False
                }
        
        # Define endpoints to test
        endpoints = ["/api/v1/health"] * 5 + ["/api/v1/metrics"] * 5
        
        # Make concurrent requests
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request, endpoint) for endpoint in endpoints]
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        
        # Check results
        success_count = sum(1 for result in results if result["success"])
        assert success_count == len(endpoints), f"Only {success_count}/{len(endpoints)} concurrent requests succeeded"