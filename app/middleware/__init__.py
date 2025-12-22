"""
Middleware Package

This package provides FastAPI middleware components for cross-cutting concerns
such as error handling, logging, and request processing.

The error handling middleware provides:
- Standardized error responses in JSON format
- Comprehensive exception logging with request context
- Handlers for validation errors, HTTP exceptions, custom exceptions, and unhandled errors

Usage:
    from app.middleware import register_exception_handlers

    app = FastAPI()
    register_exception_handlers(app)
"""

from app.middleware.error_handler import register_exception_handlers

__all__: list[str] = [
    "register_exception_handlers",
]
