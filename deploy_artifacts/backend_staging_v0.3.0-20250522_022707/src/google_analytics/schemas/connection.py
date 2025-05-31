"""Connection schemas for Google Analytics API."""
from pydantic import BaseModel, Field
from typing import Optional, Dict


class GoogleAnalyticsConnectionRequest(BaseModel):
    """Request model for Google Analytics connection."""
    service_account_json: Dict = Field(
        ..., 
        description="Service account JSON object"
    )
    description: Optional[str] = Field(
        None,
        description="Optional description for this connection"
    )
    metadata: Optional[Dict[str, str]] = Field(
        None,
        description="Optional metadata for this connection"
    )


class GoogleAnalyticsConnectionResponse(BaseModel):
    """Response model for Google Analytics connection."""
    connection_id: str = Field(
        ...,
        description="Unique identifier for this connection"
    )
    status: str = Field(
        ...,
        description="Connection status"
    )
    properties_count: int = Field(
        ...,
        description="Number of accessible properties"
    )
    created_at: str = Field(
        ...,
        description="Connection creation timestamp"
    )
    metadata: Optional[Dict[str, str]] = Field(
        None,
        description="Connection metadata"
    )