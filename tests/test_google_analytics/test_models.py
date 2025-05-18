"""
Tests for Google Analytics data models.
"""
import pytest
from datetime import date, datetime
from typing import List

from src.google_analytics.models import (
    Metric,
    Dimension,
    DateRange,
    FilterExpression,
    OrderBy,
    ReportRequest,
    Row,
    AnalyticsReport,
    SavedReport,
    BatchReportRequest,
    RealtimeRequest
)


class TestMetricModel:
    """Test cases for Metric model."""

    def test_metric_basic(self):
        """Test basic metric creation."""
        metric = Metric(name="sessions")
        assert metric.name == "sessions"
        assert metric.expression is None

    def test_metric_with_expression(self):
        """Test metric with custom expression."""
        metric = Metric(
            name="conversion_rate",
            expression="conversions / sessions"
        )
        assert metric.name == "conversion_rate"
        assert metric.expression == "conversions / sessions"

    def test_metric_validation(self):
        """Test metric validation."""
        # Empty name should fail
        with pytest.raises(ValueError):
            Metric(name="")


class TestDimensionModel:
    """Test cases for Dimension model."""

    def test_dimension_basic(self):
        """Test basic dimension creation."""
        dimension = Dimension(name="country")
        assert dimension.name == "country"

    def test_dimension_validation(self):
        """Test dimension validation."""
        # Empty name should fail
        with pytest.raises(ValueError):
            Dimension(name="")


class TestDateRangeModel:
    """Test cases for DateRange model."""

    def test_date_range_with_dates(self):
        """Test date range with date objects."""
        date_range = DateRange(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31)
        )
        assert date_range.start_date == date(2024, 1, 1)
        assert date_range.end_date == date(2024, 1, 31)

    def test_date_range_with_strings(self):
        """Test date range with string values."""
        date_range = DateRange(
            start_date="7daysAgo",
            end_date="today"
        )
        assert date_range.start_date == "7daysAgo"
        assert date_range.end_date == "today"

    def test_date_range_validation(self):
        """Test date range validation."""
        # Start date after end date should fail
        with pytest.raises(ValueError, match="Start date must be before or equal to end date"):
            DateRange(
                start_date=date(2024, 2, 1),
                end_date=date(2024, 1, 1)
            )


class TestFilterExpressionModel:
    """Test cases for FilterExpression model."""

    def test_filter_basic(self):
        """Test basic filter creation."""
        filter_expr = FilterExpression(
            field="country",
            operation="EXACT",
            value="Japan"
        )
        assert filter_expr.field == "country"
        assert filter_expr.operation == "EXACT"
        assert filter_expr.value == "Japan"

    def test_filter_operations(self):
        """Test different filter operations."""
        operations = [
            "EXACT", "CONTAINS", "BEGINS_WITH", "ENDS_WITH",
            "GREATER_THAN", "LESS_THAN", "GREATER_THAN_OR_EQUAL",
            "LESS_THAN_OR_EQUAL", "BETWEEN", "IN_LIST"
        ]
        
        for op in operations:
            filter_expr = FilterExpression(
                field="test_field",
                operation=op,
                value="test_value"
            )
            assert filter_expr.operation == op

    def test_filter_with_not(self):
        """Test filter with NOT operator."""
        filter_expr = FilterExpression(
            field="country",
            operation="EXACT",
            value="Japan",
            not_=True
        )
        assert filter_expr.not_ is True

    def test_filter_validation(self):
        """Test filter validation."""
        # Invalid operation should fail
        with pytest.raises(ValueError, match="Invalid filter operation"):
            FilterExpression(
                field="country",
                operation="INVALID_OP",
                value="Japan"
            )


class TestOrderByModel:
    """Test cases for OrderBy model."""

    def test_order_by_basic(self):
        """Test basic order by creation."""
        order_by = OrderBy(field="sessions", desc=True)
        assert order_by.field == "sessions"
        assert order_by.desc is True

    def test_order_by_ascending(self):
        """Test order by ascending (default)."""
        order_by = OrderBy(field="date")
        assert order_by.field == "date"
        assert order_by.desc is False


class TestReportRequestModel:
    """Test cases for ReportRequest model."""

    def test_report_request_minimal(self):
        """Test minimal report request."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[Metric(name="sessions")]
        )
        assert request.property_id == "123456789"
        assert len(request.metrics) == 1
        assert request.metrics[0].name == "sessions"
        assert request.dimensions == []
        assert request.date_ranges == []

    def test_report_request_full(self):
        """Test full report request with all options."""
        request = ReportRequest(
            property_id="123456789",
            metrics=[
                Metric(name="sessions"),
                Metric(name="users")
            ],
            dimensions=[
                Dimension(name="date"),
                Dimension(name="country")
            ],
            date_ranges=[
                DateRange(
                    start_date=date(2024, 1, 1),
                    end_date=date(2024, 1, 31)
                )
            ],
            dimension_filter=FilterExpression(
                field="country",
                operation="EXACT",
                value="Japan"
            ),
            metric_filter=FilterExpression(
                field="sessions",
                operation="GREATER_THAN",
                value="100"
            ),
            order_bys=[
                OrderBy(field="sessions", desc=True)
            ],
            limit=1000,
            offset=0,
            keep_empty_rows=True,
            return_property_quota=True
        )
        
        assert len(request.metrics) == 2
        assert len(request.dimensions) == 2
        assert len(request.date_ranges) == 1
        assert request.dimension_filter.field == "country"
        assert request.metric_filter.field == "sessions"
        assert len(request.order_bys) == 1
        assert request.limit == 1000
        assert request.offset == 0

    def test_report_request_validation(self):
        """Test report request validation."""
        # Missing property_id should fail
        with pytest.raises(ValueError):
            ReportRequest(metrics=[Metric(name="sessions")])
        
        # No metrics should fail
        with pytest.raises(ValueError):
            ReportRequest(property_id="123456789", metrics=[])


class TestRowModel:
    """Test cases for Row model."""

    def test_row_basic(self):
        """Test basic row creation."""
        row = Row(
            dimension_values=["2024-01-01", "Japan"],
            metric_values=[1000, 800]
        )
        assert row.dimension_values == ["2024-01-01", "Japan"]
        assert row.metric_values == [1000, 800]

    def test_row_empty(self):
        """Test row with empty values."""
        row = Row(dimension_values=[], metric_values=[100])
        assert row.dimension_values == []
        assert row.metric_values == [100]


class TestAnalyticsReportModel:
    """Test cases for AnalyticsReport model."""

    def test_analytics_report_basic(self):
        """Test basic analytics report."""
        report = AnalyticsReport(
            dimension_headers=["date", "country"],
            metric_headers=["sessions", "users"],
            rows=[
                Row(
                    dimension_values=["2024-01-01", "Japan"],
                    metric_values=[1000, 800]
                )
            ],
            total_rows=1,
            row_count=1
        )
        
        assert report.dimension_headers == ["date", "country"]
        assert report.metric_headers == ["sessions", "users"]
        assert len(report.rows) == 1
        assert report.total_rows == 1

    def test_analytics_report_with_metadata(self):
        """Test analytics report with metadata."""
        report = AnalyticsReport(
            dimension_headers=["date"],
            metric_headers=["sessions"],
            rows=[],
            total_rows=0,
            row_count=0,
            metadata={
                "currency_code": "USD",
                "time_zone": "America/New_York"
            }
        )
        
        assert report.metadata["currency_code"] == "USD"
        assert report.metadata["time_zone"] == "America/New_York"

    def test_analytics_report_with_quota(self):
        """Test analytics report with quota information."""
        report = AnalyticsReport(
            dimension_headers=["date"],
            metric_headers=["sessions"],
            rows=[],
            total_rows=0,
            row_count=0,
            property_quota={
                "tokens_per_day": {
                    "consumed": 50,
                    "remaining": 9950
                },
                "tokens_per_hour": {
                    "consumed": 10,
                    "remaining": 490
                }
            }
        )
        
        assert report.property_quota["tokens_per_day"]["consumed"] == 50
        assert report.property_quota["tokens_per_hour"]["remaining"] == 490


class TestSavedReportModel:
    """Test cases for SavedReport model."""

    def test_saved_report_basic(self):
        """Test basic saved report."""
        report = SavedReport(
            id="report_123",
            name="Monthly Traffic Report",
            property_id="123456789",
            metrics=[{"name": "sessions"}],
            dimensions=[{"name": "date"}],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        assert report.id == "report_123"
        assert report.name == "Monthly Traffic Report"
        assert report.property_id == "123456789"

    def test_saved_report_with_schedule(self):
        """Test saved report with schedule."""
        report = SavedReport(
            id="report_123",
            name="Weekly Report",
            property_id="123456789",
            metrics=[{"name": "sessions"}],
            schedule={
                "frequency": "weekly",
                "day_of_week": "monday",
                "time": "09:00"
            }
        )
        
        assert report.schedule["frequency"] == "weekly"
        assert report.schedule["day_of_week"] == "monday"


class TestBatchReportRequestModel:
    """Test cases for BatchReportRequest model."""

    def test_batch_report_request(self):
        """Test batch report request."""
        batch_request = BatchReportRequest(
            requests=[
                ReportRequest(
                    property_id="123456789",
                    metrics=[Metric(name="sessions")]
                ),
                ReportRequest(
                    property_id="123456789",
                    metrics=[Metric(name="users")]
                )
            ]
        )
        
        assert len(batch_request.requests) == 2
        assert batch_request.requests[0].metrics[0].name == "sessions"
        assert batch_request.requests[1].metrics[0].name == "users"

    def test_batch_report_validation(self):
        """Test batch report validation."""
        # Empty requests should fail
        with pytest.raises(ValueError):
            BatchReportRequest(requests=[])
        
        # Too many requests should fail
        with pytest.raises(ValueError):
            BatchReportRequest(
                requests=[
                    ReportRequest(property_id=str(i), metrics=[Metric(name="sessions")])
                    for i in range(6)  # Max is 5
                ]
            )


class TestRealtimeRequestModel:
    """Test cases for RealtimeRequest model."""

    def test_realtime_request_basic(self):
        """Test basic realtime request."""
        request = RealtimeRequest(
            property_id="123456789",
            metrics=[Metric(name="activeUsers")],
            dimensions=[Dimension(name="country")]
        )
        
        assert request.property_id == "123456789"
        assert request.metrics[0].name == "activeUsers"
        assert request.dimensions[0].name == "country"

    def test_realtime_request_with_filter(self):
        """Test realtime request with filter."""
        request = RealtimeRequest(
            property_id="123456789",
            metrics=[Metric(name="activeUsers")],
            dimension_filter=FilterExpression(
                field="country",
                operation="EXACT",
                value="Japan"
            ),
            minute_ranges=[{"name": "last30minutes"}]
        )
        
        assert request.dimension_filter.field == "country"
        assert request.minute_ranges[0]["name"] == "last30minutes"