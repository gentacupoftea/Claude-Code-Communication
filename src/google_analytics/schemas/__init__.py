"""Google Analytics Pydantic schemas."""
from .connection import GoogleAnalyticsConnectionRequest, GoogleAnalyticsConnectionResponse
from .reports import (
    StandardReportRequest, 
    StandardReportResponse,
    RealtimeReportRequest,
    RealtimeReportResponse
)
from .property import PropertyResponse
from .errors import ErrorResponse

__all__ = [
    "GoogleAnalyticsConnectionRequest",
    "GoogleAnalyticsConnectionResponse",
    "StandardReportRequest",
    "StandardReportResponse",
    "RealtimeReportRequest",
    "RealtimeReportResponse",
    "PropertyResponse",
    "ErrorResponse"
]