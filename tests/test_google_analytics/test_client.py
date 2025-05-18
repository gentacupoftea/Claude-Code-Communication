"""
Tests for Google Analytics client implementation.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, date
from typing import Dict, Any

from src.google_analytics.client import GoogleAnalyticsClient
from src.google_analytics.models import (
    AnalyticsReport,
    ReportRequest,
    Metric,
    Dimension,
    DateRange,
    FilterExpression,
    OrderBy,
    Row
)


class TestGoogleAnalyticsClient:
    """Test cases for GoogleAnalyticsClient."""

    @pytest.fixture
    def client(self):
        """Create a test client instance."""
        return GoogleAnalyticsClient(
            credentials_path="/path/to/credentials.json",
            property_id="123456789"
        )

    @pytest.mark.asyncio
    async def test_run_report_success(self, client, sample_report_request):
        """Test successful report execution."""
        # Mock the Analytics Data API response
        mock_response = Mock()
        mock_response.dimension_headers = [Mock(name="date"), Mock(name="country")]
        mock_response.metric_headers = [Mock(name="sessions"), Mock(name="users")]
        mock_response.rows = [
            Mock(dimension_values=[Mock(value="2024-01-01"), Mock(value="Japan")],
                 metric_values=[Mock(value="1000"), Mock(value="800")]),
            Mock(dimension_values=[Mock(value="2024-01-02"), Mock(value="Japan")],
                 metric_values=[Mock(value="1200"), Mock(value="950")])
        ]
        mock_response.row_count = 2
        mock_response.metadata = Mock(currency_code="USD", time_zone="Asia/Tokyo")

        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock(return_value=mock_response)
            
            request = ReportRequest(**sample_report_request)
            report = await client.run_report(request)

            assert isinstance(report, AnalyticsReport)
            assert report.row_count == 2
            assert len(report.rows) == 2
            assert report.dimension_headers == ["date", "country"]
            assert report.metric_headers == ["sessions", "users"]

    @pytest.mark.asyncio
    async def test_run_report_with_filter(self, client):
        """Test report execution with dimension filter."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[Metric(name="sessions")],
            dimensions=[Dimension(name="country")],
            date_ranges=[DateRange(start_date=date(2024, 1, 1), end_date=date(2024, 1, 7))],
            dimension_filter=FilterExpression(
                field="country",
                operation="EXACT",
                value="Japan"
            )
        )

        mock_response = Mock()
        mock_response.dimension_headers = [Mock(name="country")]
        mock_response.metric_headers = [Mock(name="sessions")]
        mock_response.rows = [
            Mock(dimension_values=[Mock(value="Japan")], metric_values=[Mock(value="5000")])
        ]
        mock_response.row_count = 1
        mock_response.metadata = Mock(currency_code="USD", time_zone="UTC")

        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock(return_value=mock_response)
            
            report = await client.run_report(request)
            
            # Verify filter was applied in the request
            call_args = mock_client.run_report.call_args[1]
            assert "dimension_filter" in call_args["request"]
            assert call_args["request"]["dimension_filter"]["filter"]["field_name"] == "country"

    @pytest.mark.asyncio
    async def test_run_report_with_multiple_date_ranges(self, client):
        """Test report execution with multiple date ranges."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[Metric(name="sessions")],
            dimensions=[Dimension(name="date")],
            date_ranges=[
                DateRange(start_date=date(2024, 1, 1), end_date=date(2024, 1, 7)),
                DateRange(start_date=date(2024, 1, 8), end_date=date(2024, 1, 14))
            ]
        )

        mock_response = Mock()
        mock_response.dimension_headers = [Mock(name="date"), Mock(name="dateRangeIndex")]
        mock_response.metric_headers = [Mock(name="sessions")]
        mock_response.rows = []
        mock_response.row_count = 0
        mock_response.metadata = Mock(currency_code="USD", time_zone="UTC")

        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock(return_value=mock_response)
            
            report = await client.run_report(request)
            
            # Verify multiple date ranges were included
            call_args = mock_client.run_report.call_args[1]
            assert len(call_args["request"]["date_ranges"]) == 2

    @pytest.mark.asyncio
    async def test_run_realtime_report(self, client):
        """Test realtime report execution."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[Metric(name="activeUsers")],
            dimensions=[Dimension(name="country")]
        )

        mock_response = Mock()
        mock_response.dimension_headers = [Mock(name="country")]
        mock_response.metric_headers = [Mock(name="activeUsers")]
        mock_response.rows = [
            Mock(dimension_values=[Mock(value="Japan")], metric_values=[Mock(value="50")]),
            Mock(dimension_values=[Mock(value="USA")], metric_values=[Mock(value="30")])
        ]
        mock_response.row_count = 2
        mock_response.metadata = Mock()

        with patch.object(client, "_client") as mock_client:
            mock_client.run_realtime_report = AsyncMock(return_value=mock_response)
            
            report = await client.run_realtime_report(request)
            
            assert isinstance(report, AnalyticsReport)
            assert report.row_count == 2
            assert len(report.rows) == 2

    @pytest.mark.asyncio
    async def test_run_report_error_handling(self, client):
        """Test error handling in report execution."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[Metric(name="sessions")],
            dimensions=[Dimension(name="date")]
        )

        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock(side_effect=Exception("API Error"))
            
            with pytest.raises(Exception, match="API Error"):
                await client.run_report(request)

    @pytest.mark.asyncio
    async def test_check_access(self, client):
        """Test property access check."""
        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock()
            
            # Test successful access
            has_access = await client.check_access()
            assert has_access is True
            
            # Test failed access
            mock_client.run_report = AsyncMock(side_effect=Exception("Permission denied"))
            has_access = await client.check_access()
            assert has_access is False

    def test_parse_date_range(self, client):
        """Test date range parsing."""
        # Test date objects
        date_range = DateRange(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 7)
        )
        parsed = client._parse_date_range(date_range)
        assert parsed == {
            "start_date": "2024-01-01",
            "end_date": "2024-01-07"
        }

        # Test string dates
        date_range = DateRange(
            start_date="7daysAgo",
            end_date="today"
        )
        parsed = client._parse_date_range(date_range)
        assert parsed == {
            "start_date": "7daysAgo",
            "end_date": "today"
        }

    def test_build_filter_expression(self, client):
        """Test filter expression building."""
        # Test simple filter
        filter_expr = FilterExpression(
            field="country",
            operation="EXACT",
            value="Japan"
        )
        built = client._build_filter_expression(filter_expr)
        assert built == {
            "filter": {
                "field_name": "country",
                "string_filter": {
                    "match_type": "EXACT",
                    "value": "Japan"
                }
            }
        }

        # Test numeric filter
        filter_expr = FilterExpression(
            field="sessions",
            operation="GREATER_THAN",
            value="1000"
        )
        built = client._build_filter_expression(filter_expr)
        assert built == {
            "filter": {
                "field_name": "sessions",
                "numeric_filter": {
                    "operation": "GREATER_THAN",
                    "value": {"int64_value": "1000"}
                }
            }
        }

    @pytest.mark.asyncio
    async def test_connection_pooling(self, client):
        """Test connection pooling behavior."""
        # Simulate multiple concurrent requests
        requests = [
            ReportRequest(
                property_id="123456789",
                metrics=[Metric(name="sessions")],
                dimensions=[Dimension(name="date")]
            )
            for _ in range(5)
        ]

        mock_response = Mock()
        mock_response.dimension_headers = []
        mock_response.metric_headers = []
        mock_response.rows = []
        mock_response.row_count = 0
        mock_response.metadata = Mock()

        with patch.object(client, "_client") as mock_client:
            mock_client.run_report = AsyncMock(return_value=mock_response)
            
            # Execute requests concurrently
            tasks = [client.run_report(req) for req in requests]
            reports = await asyncio.gather(*tasks)
            
            assert len(reports) == 5
            assert mock_client.run_report.call_count == 5