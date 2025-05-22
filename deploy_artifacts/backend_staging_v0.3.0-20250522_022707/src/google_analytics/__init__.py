"""
Google Analytics integration package for MCP Server.
"""
from src.google_analytics.client import GoogleAnalyticsClient
from src.google_analytics.models import (
    AnalyticsReport,
    ReportRequest,
    Metric,
    Dimension,
    DateRange,
    FilterExpression
)

__version__ = "1.0.0"

__all__ = [
    "GoogleAnalyticsClient",
    "AnalyticsReport",
    "ReportRequest",
    "Metric",
    "Dimension",
    "DateRange",
    "FilterExpression"
]