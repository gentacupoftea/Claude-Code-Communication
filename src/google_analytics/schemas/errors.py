"""Error schemas for Google Analytics API."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


class ErrorDetail(BaseModel):
    """Detailed error information."""
    field: Optional[str] = Field(None, description="Field that caused error")
    reason: str = Field(..., description="Error reason code")
    message: str = Field(..., description="Human-readable error message")


class ErrorResponse(BaseModel):
    """Standard error response."""
    error_code: str = Field(
        ...,
        description="Error code identifier"
    )
    message: str = Field(
        ...,
        description="Main error message"
    )
    details: Optional[List[ErrorDetail]] = Field(
        None,
        description="Detailed error information"
    )
    status_code: int = Field(
        ...,
        description="HTTP status code"
    )
    request_id: Optional[str] = Field(
        None,
        description="Request ID for tracking"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional error metadata"
    )