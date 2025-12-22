"""Pydantic schemas for standardized API error responses."""

from typing import Optional

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Schema for standardized API error responses.

    This schema provides a consistent JSON structure for all API errors,
    including validation errors, HTTP exceptions, and unhandled exceptions.
    """

    status_code: int = Field(..., description="HTTP status code")
    error_type: str = Field(..., description="Error classification (e.g., validation_error, not_found)")
    message: str = Field(..., description="Human-readable error message")
    detail: Optional[str] = Field(None, description="Additional error details for debugging")
    request_id: Optional[str] = Field(None, description="Request identifier for tracing and log correlation")
