"""Tests for API endpoints."""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.data_integration.api.endpoints import app
from src.data_integration.dependencies import get_shopify_service, get_analytics_service

@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)

@pytest.fixture
def mock_dependencies(mock_shopify_api, mock_analytics_api, mock_cache_manager, mock_metrics_collector):
    """Mock service dependencies."""
    def override_shopify_service():
        service = Mock()
        service.get_products.return_value = mock_shopify_api.get_products()
        service.get_orders.return_value = mock_shopify_api.get_orders()
        service.get_customers.return_value = mock_shopify_api.get_customers()
        return service
    
    def override_analytics_service():
        service = Mock()
        service.get_page_views.return_value = mock_analytics_api.get_page_views()
        service.get_conversion_data.return_value = mock_analytics_api.get_conversion_data()
        return service
    
    app.dependency_overrides[get_shopify_service] = override_shopify_service
    app.dependency_overrides[get_analytics_service] = override_analytics_service
    
    yield
    
    app.dependency_overrides.clear()

class TestAPIEndpoints:
    """Tests for API endpoints."""
    
    def test_get_unified_dashboard(self, client, mock_dependencies, sample_customer_data):
        """Test unified dashboard endpoint."""
        response = client.get("/v1/dashboard?store_domain=test.myshopify.com")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "revenue_metrics" in data
        assert "customer_analytics" in data
        assert "product_performance" in data
        assert "channel_metrics" in data
    
    def test_get_predictions(self, client, mock_dependencies):
        """Test predictions endpoint."""
        response = client.get("/v1/predictions?store_domain=test.myshopify.com")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "churn_predictions" in data
        assert "demand_forecast" in data
        assert "ltv_predictions" in data
    
    def test_get_insights(self, client, mock_dependencies):
        """Test insights endpoint."""
        response = client.get("/v1/insights?store_domain=test.myshopify.com")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "key_trends" in data
        assert "recommendations" in data
        assert "actionable_insights" in data
    
    def test_search_products(self, client, mock_dependencies):
        """Test product search endpoint."""
        response = client.get("/v1/search/products?query=test&store_domain=test.myshopify.com")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if data:
            assert "id" in data[0]
            assert "title" in data[0]
            assert "score" in data[0]
    
    def test_search_customers(self, client, mock_dependencies):
        """Test customer search endpoint."""
        response = client.get("/v1/search/customers?query=test@example.com&store_domain=test.myshopify.com")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if data:
            assert "id" in data[0]
            assert "email" in data[0]
            assert "score" in data[0]
    
    def test_get_analytics_summary(self, client, mock_dependencies):
        """Test analytics summary endpoint."""
        response = client.get(
            "/v1/analytics/summary?store_domain=test.myshopify.com&start_date=2023-01-01&end_date=2023-12-31"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "period" in data
        assert "total_revenue" in data
        assert "total_orders" in data
        assert "average_order_value" in data
        assert "conversion_rate" in data
    
    def test_generate_report(self, client, mock_dependencies):
        """Test report generation endpoint."""
        response = client.post(
            "/v1/reports/generate",
            json={
                "report_type": "monthly_performance",
                "store_domain": "test.myshopify.com",
                "start_date": "2023-01-01",
                "end_date": "2023-01-31"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "report_id" in data
        assert "status" in data
    
    def test_get_report_status(self, client, mock_dependencies):
        """Test report status endpoint."""
        report_id = "test_report_123"
        response = client.get(f"/v1/reports/{report_id}/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "report_id" in data
        assert "status" in data
    
    def test_invalid_store_domain(self, client, mock_dependencies):
        """Test invalid store domain."""
        response = client.get("/v1/dashboard?store_domain=invalid")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_missing_parameters(self, client, mock_dependencies):
        """Test missing required parameters."""
        response = client.get("/v1/dashboard")
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    def test_date_range_validation(self, client, mock_dependencies):
        """Test date range validation."""
        response = client.get(
            "/v1/analytics/summary?store_domain=test.myshopify.com&start_date=2023-12-31&end_date=2023-01-01"
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "date range" in data["detail"].lower()
    
    def test_concurrent_requests(self, client, mock_dependencies):
        """Test handling concurrent requests."""
        import threading
        import time
        
        results = []
        
        def make_request():
            response = client.get("/v1/dashboard?store_domain=test.myshopify.com")
            results.append(response.status_code)
        
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        assert all(status == 200 for status in results)
    
    def test_error_handling(self, client, mock_dependencies):
        """Test error handling."""
        # Mock service to raise an exception
        def override_shopify_service():
            service = Mock()
            service.get_products.side_effect = Exception("API Error")
            return service
        
        app.dependency_overrides[get_shopify_service] = override_shopify_service
        
        response = client.get("/v1/dashboard?store_domain=test.myshopify.com")
        
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
