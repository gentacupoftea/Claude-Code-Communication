"""Data Integration Module for Shopify MCP Server."""

__version__ = "1.0.0"
__author__ = "Your Name"
__email__ = "your.email@example.com"

from src.data_integration.services.shopify_service import ShopifyService
from src.data_integration.services.analytics_service import AnalyticsService
from src.data_integration.services.email_service import EmailService
from src.data_integration.analytics.unified_analytics import UnifiedAnalyticsEngine

__all__ = [
    "ShopifyService",
    "AnalyticsService",
    "EmailService",
    "UnifiedAnalyticsEngine",
]
