"""Property schemas for Google Analytics API."""
from pydantic import BaseModel, Field
from typing import Optional, List


class PropertyResponse(BaseModel):
    """Response model for GA property."""
    property_id: str = Field(
        ...,
        description="Property ID (e.g., 'properties/123456')"
    )
    display_name: str = Field(
        ...,
        description="Property display name"
    )
    property_type: str = Field(
        ...,
        description="Property type (GA4, Universal Analytics)"
    )
    time_zone: str = Field(
        ...,
        description="Property timezone"
    )
    currency_code: str = Field(
        ...,
        description="Property currency code"
    )
    industry_category: Optional[str] = Field(
        None,
        description="Industry category"
    )
    created_time: str = Field(
        ...,
        description="Property creation time"
    )
    parent: Optional[str] = Field(
        None,
        description="Parent account"
    )


class PropertiesListResponse(BaseModel):
    """Response model for listing GA properties."""
    properties: List[PropertyResponse] = Field(
        default_factory=list,
        description="List of accessible properties"
    )
    count: int = Field(
        ...,
        description="Total number of properties"
    )
    next_page_token: Optional[str] = Field(
        None,
        description="Token for pagination"
    )