"""
Tests for Google Analytics API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from datetime import date

from src.google_analytics.main import app
from src.google_analytics.models import AnalyticsReport, Row
from src.google_analytics.dependencies import get_analytics_client, get_cache_layer


class TestGoogleAnalyticsAPI:
    """Test cases for Google Analytics API endpoints."""

    @pytest.fixture
    def client(self, mock_analytics_client, mock_redis_client):
        """Create a test client with mocked dependencies."""
        app.dependency_overrides[get_analytics_client] = lambda: mock_analytics_client
        app.dependency_overrides[get_cache_layer] = lambda: Mock(
            get=AsyncMock(return_value=None),
            set=AsyncMock(),
            invalidate_pattern=AsyncMock()
        )
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Authorization headers for API requests."""
        return {"Authorization": "Bearer test_token"}

    def test_run_report_success(self, client, auth_headers, sample_analytics_report, mock_analytics_client):
        """Test successful report execution."""
        mock_analytics_client.run_report.return_value = sample_analytics_report
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}, {"name": "users"}],
            "dimensions": [{"name": "date"}, {"name": "country"}],
            "date_ranges": [{
                "start_date": "2024-01-01",
                "end_date": "2024-01-07"
            }]
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 2
        assert len(data["rows"]) == 2
        assert data["dimension_headers"] == ["date", "country"]
        assert data["metric_headers"] == ["sessions", "users"]

    def test_run_report_validation_error(self, client, auth_headers):
        """Test report request validation."""
        request_data = {
            "property_id": "123456789",
            # Missing required metrics
            "dimensions": [{"name": "date"}]
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert "metrics" in response.json()["detail"][0]["loc"]

    def test_run_report_with_filter(self, client, auth_headers, sample_analytics_report, mock_analytics_client):
        """Test report with dimension filter."""
        mock_analytics_client.run_report.return_value = sample_analytics_report
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "country"}],
            "date_ranges": [{
                "start_date": "2024-01-01",
                "end_date": "2024-01-07"
            }],
            "dimension_filter": {
                "field": "country",
                "operation": "EXACT",
                "value": "Japan"
            }
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Verify filter was passed to client
        call_args = mock_analytics_client.run_report.call_args[0][0]
        assert call_args.dimension_filter.field == "country"
        assert call_args.dimension_filter.value == "Japan"

    def test_run_report_with_ordering(self, client, auth_headers, sample_analytics_report, mock_analytics_client):
        """Test report with ordering."""
        mock_analytics_client.run_report.return_value = sample_analytics_report
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "date"}],
            "order_bys": [{
                "field": "sessions",
                "desc": True
            }]
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Verify ordering was passed to client
        call_args = mock_analytics_client.run_report.call_args[0][0]
        assert len(call_args.order_bys) == 1
        assert call_args.order_bys[0].field == "sessions"
        assert call_args.order_bys[0].desc is True

    def test_run_report_with_pagination(self, client, auth_headers, sample_analytics_report, mock_analytics_client):
        """Test report with pagination."""
        mock_analytics_client.run_report.return_value = sample_analytics_report
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "date"}],
            "limit": 10,
            "offset": 20
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Verify pagination was passed to client
        call_args = mock_analytics_client.run_report.call_args[0][0]
        assert call_args.limit == 10
        assert call_args.offset == 20

    def test_run_realtime_report(self, client, auth_headers, sample_analytics_report, mock_analytics_client):
        """Test realtime report execution."""
        mock_analytics_client.run_realtime_report.return_value = sample_analytics_report
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "activeUsers"}],
            "dimensions": [{"name": "country"}]
        }
        
        response = client.post(
            "/api/v1/google-analytics/realtime/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 2

    def test_get_report_by_id(self, client, auth_headers):
        """Test getting report by ID."""
        report_id = "test_report_123"
        
        with patch("src.google_analytics.api.get_saved_report") as mock_get_report:
            mock_get_report.return_value = {
                "id": report_id,
                "name": "Test Report",
                "config": {"property_id": "123456789"}
            }
            
            response = client.get(
                f"/api/v1/google-analytics/reports/{report_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == report_id
            assert data["name"] == "Test Report"

    def test_list_reports(self, client, auth_headers):
        """Test listing saved reports."""
        with patch("src.google_analytics.api.list_saved_reports") as mock_list_reports:
            mock_list_reports.return_value = [
                {"id": "report1", "name": "Report 1"},
                {"id": "report2", "name": "Report 2"}
            ]
            
            response = client.get(
                "/api/v1/google-analytics/reports",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["id"] == "report1"

    def test_create_saved_report(self, client, auth_headers):
        """Test creating a saved report."""
        report_config = {
            "name": "Monthly Traffic Report",
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "date"}],
            "date_ranges": [{
                "start_date": "30daysAgo",
                "end_date": "today"
            }]
        }
        
        with patch("src.google_analytics.api.save_report") as mock_save_report:
            mock_save_report.return_value = {"id": "new_report_123", **report_config}
            
            response = client.post(
                "/api/v1/google-analytics/reports/save",
                json=report_config,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.json()
            assert data["id"] == "new_report_123"
            assert data["name"] == "Monthly Traffic Report"

    def test_delete_report(self, client, auth_headers):
        """Test deleting a saved report."""
        report_id = "report_to_delete"
        
        with patch("src.google_analytics.api.delete_saved_report") as mock_delete_report:
            response = client.delete(
                f"/api/v1/google-analytics/reports/{report_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 204
            mock_delete_report.assert_called_once_with(report_id)

    def test_run_report_cache_hit(self, client, auth_headers, sample_analytics_report):
        """Test report execution with cache hit."""
        with patch("src.google_analytics.dependencies.get_cache_layer") as mock_get_cache:
            mock_cache = Mock()
            mock_cache.get = AsyncMock(return_value=sample_analytics_report)
            mock_get_cache.return_value = mock_cache
            
            request_data = {
                "property_id": "123456789",
                "metrics": [{"name": "sessions"}],
                "dimensions": [{"name": "date"}]
            }
            
            response = client.post(
                "/api/v1/google-analytics/reports",
                json=request_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["cache_hit"] is True

    def test_invalidate_cache(self, client, auth_headers):
        """Test cache invalidation endpoint."""
        property_id = "123456789"
        
        with patch("src.google_analytics.dependencies.get_cache_layer") as mock_get_cache:
            mock_cache = Mock()
            mock_cache.invalidate_pattern = AsyncMock()
            mock_get_cache.return_value = mock_cache
            
            response = client.post(
                f"/api/v1/google-analytics/cache/invalidate/{property_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            mock_cache.invalidate_pattern.assert_called_once()

    def test_error_handling(self, client, auth_headers, mock_analytics_client):
        """Test API error handling."""
        mock_analytics_client.run_report.side_effect = Exception("GA4 API Error")
        
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}],
            "dimensions": [{"name": "date"}]
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 500
        assert "GA4 API Error" in response.json()["detail"]

    def test_unauthorized_request(self, client):
        """Test unauthorized request handling."""
        request_data = {
            "property_id": "123456789",
            "metrics": [{"name": "sessions"}]
        }
        
        response = client.post(
            "/api/v1/google-analytics/reports",
            json=request_data
            # No auth headers
        )
        
        assert response.status_code == 401