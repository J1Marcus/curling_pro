"""Test endpoints for error handling verification.

This module provides test endpoints that trigger various error types
to verify the error handling middleware is working correctly.

These endpoints should ONLY be used in development/testing environments.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.exceptions import (
    BusinessLogicError,
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)

router = APIRouter()


class TestPayload(BaseModel):
    """Test payload schema for validation error testing."""

    name: str = Field(..., min_length=1, max_length=100, description="Name field")
    age: int = Field(..., ge=0, le=150, description="Age field")
    email: str = Field(..., description="Email field")


@router.get("/not-found")
async def trigger_not_found_error() -> dict:
    """Trigger a NotFoundError (404) for testing.

    Returns:
        Never returns - always raises NotFoundError.
    """
    raise NotFoundError("Resource with ID '12345' was not found.")


@router.get("/validation-error")
async def trigger_validation_error() -> dict:
    """Trigger a custom ValidationError (400) for testing.

    Returns:
        Never returns - always raises ValidationError.
    """
    raise ValidationError("Email address format is invalid.")


@router.get("/unauthorized")
async def trigger_unauthorized_error() -> dict:
    """Trigger an UnauthorizedError (401) for testing.

    Returns:
        Never returns - always raises UnauthorizedError.
    """
    raise UnauthorizedError("Invalid API key provided.")


@router.get("/forbidden")
async def trigger_forbidden_error() -> dict:
    """Trigger a ForbiddenError (403) for testing.

    Returns:
        Never returns - always raises ForbiddenError.
    """
    raise ForbiddenError("You do not have permission to access this resource.")


@router.get("/database-error")
async def trigger_database_error() -> dict:
    """Trigger a DatabaseError (503) for testing.

    Returns:
        Never returns - always raises DatabaseError.
    """
    raise DatabaseError("Unable to connect to database.")


@router.get("/business-logic-error")
async def trigger_business_logic_error() -> dict:
    """Trigger a BusinessLogicError (422) for testing.

    Returns:
        Never returns - always raises BusinessLogicError.
    """
    raise BusinessLogicError("Cannot complete order: insufficient inventory.")


@router.get("/http-exception/{status_code}")
async def trigger_http_exception(status_code: int) -> dict:
    """Trigger an HTTPException with custom status code for testing.

    Args:
        status_code: The HTTP status code to return (e.g., 404, 500).

    Returns:
        Never returns - always raises HTTPException.
    """
    raise HTTPException(status_code=status_code, detail=f"Test HTTP exception with status {status_code}")


@router.get("/unhandled-error")
async def trigger_unhandled_error() -> dict:
    """Trigger an unhandled exception (500) for testing.

    This endpoint raises a RuntimeError which is not explicitly handled,
    testing the catch-all exception handler.

    Returns:
        Never returns - always raises RuntimeError.
    """
    raise RuntimeError("This is an unexpected error that should be caught by the catch-all handler.")


@router.post("/pydantic-validation")
async def trigger_pydantic_validation_error(payload: TestPayload) -> dict:
    """Test Pydantic request validation error (422).

    Send invalid data to trigger Pydantic's RequestValidationError.

    Args:
        payload: Test payload that must conform to TestPayload schema.

    Returns:
        dict: Success response if validation passes.
    """
    return {"status": "success", "data": payload.model_dump()}


@router.get("/success")
async def success_endpoint() -> dict:
    """Test successful response (200) for comparison.

    Returns:
        dict: Success response with status and message.
    """
    return {"status": "success", "message": "This endpoint works correctly."}
