"""
Pytest configuration and fixtures for Google Analytics tests.
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock
import asyncio

from src.google_analytics.models import (
    AnalyticsReport,
    Dimension,
    Metric,
    DateRange,
    FilterExpression,
    OrderBy,
    Row
)


@pytest.fixture
def mock_analytics_client():
    """Mock Google Analytics client."""
    client = Mock()
    client.run_report = AsyncMock()
    client.run_realtime_report = AsyncMock()
    client.check_access = AsyncMock(return_value=True)
    return client


@pytest.fixture
def sample_metrics() -> List[Metric]:
    """Sample metrics for testing."""
    return [
        Metric(name="sessions"),
        Metric(name="users"),
        Metric(name="bounceRate"),
        Metric(expression="sessions / users"),
    ]


@pytest.fixture
def sample_dimensions() -> List[Dimension]:
    """Sample dimensions for testing."""
    return [
        Dimension(name="date"),
        Dimension(name="country"),
        Dimension(name="deviceCategory"),
    ]


@pytest.fixture
def sample_date_range() -> DateRange:
    """Sample date range for testing."""
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=7)
    return DateRange(
        start_date=start_date,
        end_date=end_date
    )


@pytest.fixture
def sample_filter() -> FilterExpression:
    """Sample filter expression for testing."""
    return FilterExpression(
        field="country",
        operation="EXACT",
        value="Japan"
    )


@pytest.fixture
def sample_report_request() -> Dict[str, Any]:
    """Sample report request for testing."""
    return {
        "property_id": "123456789",
        "metrics": [
            {"name": "sessions"},
            {"name": "users"}
        ],
        "dimensions": [
            {"name": "date"},
            {"name": "country"}
        ],
        "date_ranges": [{
            "start_date": "2024-01-01",
            "end_date": "2024-01-07"
        }],
        "dimension_filter": {
            "field": "country",
            "operation": "EXACT",
            "value": "Japan"
        },
        "order_bys": [{
            "field": "sessions",
            "desc": True
        }],
        "limit": 100,
        "offset": 0
    }


@pytest.fixture
def sample_analytics_report() -> AnalyticsReport:
    """Sample analytics report for testing."""
    return AnalyticsReport(
        dimension_headers=["date", "country"],
        metric_headers=["sessions", "users"],
        rows=[
            Row(
                dimension_values=["2024-01-01", "Japan"],
                metric_values=[1000, 800]
            ),
            Row(
                dimension_values=["2024-01-02", "Japan"],
                metric_values=[1200, 950]
            ),
        ],
        total_rows=2,
        row_count=2,
        metadata={
            "currency_code": "USD",
            "time_zone": "Asia/Tokyo"
        }
    )


@pytest.fixture
def mock_request():
    """Mock FastAPI request object."""
    request = Mock()
    request.state = Mock()
    return request


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for caching."""
    client = Mock()
    client.get = AsyncMock(return_value=None)
    client.setex = AsyncMock()
    client.delete = AsyncMock()
    client.exists = AsyncMock(return_value=False)
    return client


@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_realtime_data() -> Dict[str, Any]:
    """Sample realtime data for testing."""
    return {
        "active_users": 150,
        "page_views": 450,
        "events_per_second": 2.5,
        "top_pages": [
            {"page": "/", "users": 50},
            {"page": "/products", "users": 30},
            {"page": "/about", "users": 20}
        ],
        "user_demographics": {
            "countries": {
                "Japan": 80,
                "USA": 40,
                "UK": 30
            },
            "devices": {
                "mobile": 90,
                "desktop": 50,
                "tablet": 10
            }
        }
    }