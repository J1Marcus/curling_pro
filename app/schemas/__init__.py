"""
Pydantic Schemas Package

This package provides Pydantic schemas for request/response validation.
All schemas are exported from their respective modules for convenient imports.

Usage:
    from app.schemas import ErrorResponse
"""

from app.schemas.error_schema import ErrorResponse

__all__ = [
    "ErrorResponse",
]
