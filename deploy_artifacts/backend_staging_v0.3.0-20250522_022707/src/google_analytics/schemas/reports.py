"""Report schemas for Google Analytics API."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date


class DateRange(BaseModel):
    """Date range for reports."""
    startDate: str = Field(..., description="Start date (YYYY-MM-DD)")
    endDate: str = Field(..., description="End date (YYYY-MM-DD)")


class Dimension(BaseModel):
    """Dimension configuration."""
    name: str = Field(..., description="Dimension name")


class Metric(BaseModel):
    """Metric configuration."""
    name: str = Field(..., description="Metric name")


class OrderBy(BaseModel):
    """Order by configuration."""
    metric: Optional[Metric] = None
    dimension: Optional[Dimension] = None
    desc: bool = Field(False, description="Sort in descending order")


class StandardReportRequest(BaseModel):
    """Request model for standard GA reports."""
    property_id: str = Field(
        ...,
        description="GA property ID (e.g., 'properties/123456')"
    )
    date_range: DateRange = Field(
        ...,
        description="Date range for the report"
    )
    dimensions: List[Dimension] = Field(
        default_factory=list,
        description="Report dimensions"
    )
    metrics: List[Metric] = Field(
        ...,
        description="Report metrics",
        min_items=1
    )
    order_bys: Optional[List[OrderBy]] = Field(
        None,
        description="Sort order"
    )
    dimension_filter: Optional[Dict[str, Any]] = Field(
        None,
        description="Dimension filter"
    )
    metric_filter: Optional[Dict[str, Any]] = Field(
        None,
        description="Metric filter"
    )
    limit: int = Field(
        10000,
        description="Maximum rows to return",
        ge=1,
        le=100000
    )
    offset: int = Field(
        0,
        description="Row offset",
        ge=0
    )


class ReportRow(BaseModel):
    """Single row in report data."""
    dimensions: Dict[str, str] = Field(
        default_factory=dict,
        description="Dimension values"
    )
    metrics: Dict[str, float] = Field(
        default_factory=dict,
        description="Metric values"
    )


class StandardReportResponse(BaseModel):
    """Response model for standard GA reports."""
    report_id: str = Field(
        ...,
        description="Unique report identifier"
    )
    property_id: str = Field(
        ...,
        description="GA property ID"
    )
    date_range: DateRange = Field(
        ...,
        description="Report date range"
    )
    rows: List[ReportRow] = Field(
        default_factory=list,
        description="Report data rows"
    )
    row_count: int = Field(
        ...,
        description="Total number of rows"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Report metadata"
    )
    created_at: str = Field(
        ...,
        description="Report creation timestamp"
    )


class RealtimeDimension(BaseModel):
    """Realtime dimension configuration."""
    name: str = Field(..., description="Dimension name")


class RealtimeMetric(BaseModel):
    """Realtime metric configuration."""
    name: str = Field(..., description="Metric name")


class RealtimeReportRequest(BaseModel):
    """Request model for realtime GA reports."""
    property_id: str = Field(
        ...,
        description="GA property ID (e.g., 'properties/123456')"
    )
    dimensions: List[RealtimeDimension] = Field(
        default_factory=list,
        description="Report dimensions"
    )
    metrics: List[RealtimeMetric] = Field(
        ...,
        description="Report metrics",
        min_items=1
    )
    dimension_filter: Optional[Dict[str, Any]] = Field(
        None,
        description="Dimension filter"
    )
    metric_filter: Optional[Dict[str, Any]] = Field(
        None,
        description="Metric filter"
    )
    limit: int = Field(
        10000,
        description="Maximum rows to return",
        ge=1,
        le=100000
    )
    minute_ranges: Optional[List[Dict[str, int]]] = Field(
        None,
        description="Time ranges in minutes"
    )


class RealtimeReportResponse(BaseModel):
    """Response model for realtime GA reports."""
    report_id: str = Field(
        ...,
        description="Unique report identifier"
    )
    property_id: str = Field(
        ...,
        description="GA property ID"
    )
    rows: List[ReportRow] = Field(
        default_factory=list,
        description="Report data rows"
    )
    row_count: int = Field(
        ...,
        description="Total number of rows"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Report metadata"
    )
    created_at: str = Field(
        ...,
        description="Report creation timestamp"
    )