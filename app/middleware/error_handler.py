"""Error handling middleware for FastAPI.

This module provides centralized exception handling with comprehensive logging
and standardized error responses. All exceptions are logged with request context
for debugging and monitoring purposes.
"""

import logging
import traceback
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request

if TYPE_CHECKING:
    from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

from app.core.exceptions import (
    BusinessLogicError,
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.schemas.error_schema import ErrorResponse

logger = logging.getLogger(__name__)


def log_error_with_context(
    request: Request,
    exc: Exception,
    *,
    log_level: int = logging.ERROR,
) -> None:
    """Log an exception with comprehensive request context.

    Logs the exception with relevant request details for debugging and monitoring.
    The log includes request path, HTTP method, client IP, user agent, exception
    type, exception message, and full stack trace.

    Args:
        request: The FastAPI request object containing request details.
        exc: The exception that was raised.
        log_level: The logging level to use (default: logging.ERROR).
            Use logging.WARNING for 4xx client errors.
            Use logging.ERROR for 5xx server errors.

    Example:
        >>> from fastapi import Request
        >>> try:
        ...     raise ValueError("Something went wrong")
        ... except ValueError as e:
        ...     log_error_with_context(request, e, log_level=logging.WARNING)
    """
    # Extract request context
    path = request.url.path
    method = request.method
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    # Get exception details
    exception_type = type(exc).__name__
    exception_message = str(exc)

    # Format stack trace
    stack_trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))

    # Build structured log message
    log_message = (
        f"Exception occurred during request\n"
        f"  Path: {method} {path}\n"
        f"  Client IP: {client_ip}\n"
        f"  User Agent: {user_agent}\n"
        f"  Exception Type: {exception_type}\n"
        f"  Message: {exception_message}\n"
        f"  Stack Trace:\n{stack_trace}"
    )

    logger.log(log_level, log_message)


def _get_client_ip(request: Request) -> str:
    """Extract the client IP address from the request.

    Handles common proxy headers (X-Forwarded-For, X-Real-IP) to extract
    the original client IP when the application is behind a reverse proxy.

    Args:
        request: The FastAPI request object.

    Returns:
        The client IP address as a string.
    """
    # Check for X-Forwarded-For header (common with reverse proxies)
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        # X-Forwarded-For can contain multiple IPs; the first is the original client
        return x_forwarded_for.split(",")[0].strip()

    # Check for X-Real-IP header (nginx default)
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()

    # Fall back to direct client connection
    if request.client:
        return request.client.host

    return "unknown"


def _format_validation_errors(errors: list[dict]) -> str:
    """Format Pydantic validation errors into a human-readable string.

    Extracts field locations and error messages from Pydantic validation errors
    and formats them into a concise, readable format for API responses.

    Args:
        errors: List of error dictionaries from Pydantic's ValidationError.

    Returns:
        A formatted string with field-specific error details.
    """
    formatted_errors = []
    for error in errors:
        # Build field path from location (e.g., ["body", "user", "email"] -> "body.user.email")
        location = ".".join(str(loc) for loc in error.get("loc", []))
        message = error.get("msg", "Invalid value")
        error_type = error.get("type", "value_error")
        formatted_errors.append(f"{location}: {message} (type={error_type})")

    return "; ".join(formatted_errors)


async def request_validation_error_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle FastAPI RequestValidationError exceptions.

    This handler is triggered when Pydantic validation fails on incoming request
    data (body, query parameters, path parameters, etc.). It returns a 422
    Unprocessable Entity response with field-specific validation error details.

    Args:
        request: The FastAPI request object.
        exc: The RequestValidationError raised by Pydantic.

    Returns:
        JSONResponse with 422 status code and ErrorResponse-formatted body
        containing field-specific validation error details.

    Example response:
        {
            "status_code": 422,
            "error_type": "validation_error",
            "message": "Request validation failed",
            "detail": "body.email: field required (type=missing); body.age: value is not a valid integer (type=int_parsing)",
            "request_id": null
        }
    """
    # Log the validation error with request context (use WARNING for 4xx errors)
    log_error_with_context(request, exc, log_level=logging.WARNING)

    # Extract and format field-specific errors
    validation_errors = exc.errors()
    detail = _format_validation_errors(validation_errors)

    # Build error response
    error_response = ErrorResponse(
        status_code=422,
        error_type="validation_error",
        message="Request validation failed",
        detail=detail,
        request_id=None,
    )

    return JSONResponse(
        status_code=422,
        content=error_response.model_dump(),
    )


def _get_error_type_from_status_code(status_code: int) -> str:
    """Map HTTP status codes to error type strings.

    Args:
        status_code: The HTTP status code.

    Returns:
        A string representing the error type classification.
    """
    error_types = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        410: "gone",
        422: "unprocessable_entity",
        429: "too_many_requests",
        500: "internal_server_error",
        502: "bad_gateway",
        503: "service_unavailable",
        504: "gateway_timeout",
    }
    return error_types.get(status_code, "http_error")


async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Handle FastAPI HTTPException exceptions.

    This handler is triggered when an HTTPException is explicitly raised in the
    application code. It preserves the original status code and message from
    the exception while returning a standardized ErrorResponse format.

    Args:
        request: The FastAPI request object.
        exc: The HTTPException raised in the application.

    Returns:
        JSONResponse with the original status code and ErrorResponse-formatted
        body containing the exception's detail message.

    Example response:
        {
            "status_code": 404,
            "error_type": "not_found",
            "message": "User not found",
            "detail": null,
            "request_id": null
        }
    """
    # Determine appropriate log level based on status code
    # Use WARNING for 4xx client errors, ERROR for 5xx server errors
    log_level = logging.WARNING if exc.status_code < 500 else logging.ERROR

    # Log the exception with request context
    log_error_with_context(request, exc, log_level=log_level)

    # Get error type classification from status code
    error_type = _get_error_type_from_status_code(exc.status_code)

    # Extract message from exception detail
    # HTTPException.detail can be a string or dict; convert to string for message
    message = str(exc.detail) if exc.detail else "An error occurred"

    # Build error response preserving original status code and message
    error_response = ErrorResponse(
        status_code=exc.status_code,
        error_type=error_type,
        message=message,
        detail=None,
        request_id=None,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(),
    )


# Type alias for all custom exceptions with status_code attribute
CustomException = (
    NotFoundError
    | ValidationError
    | UnauthorizedError
    | ForbiddenError
    | DatabaseError
    | BusinessLogicError
)


async def custom_exception_handler(
    request: Request,
    exc: CustomException,
) -> JSONResponse:
    """Handle custom application exceptions.

    This handler processes all custom exceptions defined in app.core.exceptions
    that have a status_code attribute. It provides consistent error responses
    while logging with appropriate severity levels.

    Supported exceptions:
        - NotFoundError (404): Resource not found
        - ValidationError (400): Business logic validation failure
        - UnauthorizedError (401): Authentication failure
        - ForbiddenError (403): Permission denied
        - DatabaseError (503): Database operation failure
        - BusinessLogicError (422): Domain rule violation

    Args:
        request: The FastAPI request object.
        exc: A custom exception with status_code attribute.

    Returns:
        JSONResponse with the exception's status code and ErrorResponse-formatted
        body containing the exception message.

    Example response:
        {
            "status_code": 404,
            "error_type": "not_found",
            "message": "User with id '123' not found",
            "detail": null,
            "request_id": null
        }
    """
    # Get status code from exception attribute
    status_code = exc.status_code

    # Determine appropriate log level based on status code
    # Use WARNING for 4xx client errors, ERROR for 5xx server errors
    log_level = logging.WARNING if status_code < 500 else logging.ERROR

    # Log the exception with request context
    log_error_with_context(request, exc, log_level=log_level)

    # Get error type classification from status code
    error_type = _get_error_type_from_status_code(status_code)

    # Extract message from exception
    message = str(exc)

    # Build error response
    error_response = ErrorResponse(
        status_code=status_code,
        error_type=error_type,
        message=message,
        detail=None,
        request_id=None,
    )

    return JSONResponse(
        status_code=status_code,
        content=error_response.model_dump(),
    )


async def not_found_error_handler(
    request: Request,
    exc: NotFoundError,
) -> JSONResponse:
    """Handle NotFoundError exceptions.

    Wrapper handler for NotFoundError that delegates to the base custom
    exception handler. Returns 404 Not Found with the error message.

    Args:
        request: The FastAPI request object.
        exc: The NotFoundError exception.

    Returns:
        JSONResponse with 404 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


async def validation_error_handler(
    request: Request,
    exc: ValidationError,
) -> JSONResponse:
    """Handle custom ValidationError exceptions.

    Wrapper handler for ValidationError (business logic validation failures)
    that delegates to the base custom exception handler. Returns 400 Bad Request
    with the error message.

    Note: This is distinct from Pydantic's RequestValidationError which is
    handled by request_validation_error_handler.

    Args:
        request: The FastAPI request object.
        exc: The ValidationError exception.

    Returns:
        JSONResponse with 400 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


async def unauthorized_error_handler(
    request: Request,
    exc: UnauthorizedError,
) -> JSONResponse:
    """Handle UnauthorizedError exceptions.

    Wrapper handler for UnauthorizedError (authentication failures) that
    delegates to the base custom exception handler. Returns 401 Unauthorized
    with the error message.

    Args:
        request: The FastAPI request object.
        exc: The UnauthorizedError exception.

    Returns:
        JSONResponse with 401 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


async def forbidden_error_handler(
    request: Request,
    exc: ForbiddenError,
) -> JSONResponse:
    """Handle ForbiddenError exceptions.

    Wrapper handler for ForbiddenError (permission denied) that delegates
    to the base custom exception handler. Returns 403 Forbidden with the
    error message.

    Args:
        request: The FastAPI request object.
        exc: The ForbiddenError exception.

    Returns:
        JSONResponse with 403 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


async def database_error_handler(
    request: Request,
    exc: DatabaseError,
) -> JSONResponse:
    """Handle DatabaseError exceptions.

    Wrapper handler for DatabaseError (database operation failures) that
    delegates to the base custom exception handler. Returns 503 Service
    Unavailable with a generic message.

    Note: The full database error details are logged but not exposed in the
    response to prevent leaking sensitive information.

    Args:
        request: The FastAPI request object.
        exc: The DatabaseError exception.

    Returns:
        JSONResponse with 503 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


async def business_logic_error_handler(
    request: Request,
    exc: BusinessLogicError,
) -> JSONResponse:
    """Handle BusinessLogicError exceptions.

    Wrapper handler for BusinessLogicError (domain rule violations) that
    delegates to the base custom exception handler. Returns 422 Unprocessable
    Entity with the error message.

    Args:
        request: The FastAPI request object.
        exc: The BusinessLogicError exception.

    Returns:
        JSONResponse with 422 status code and ErrorResponse body.
    """
    return await custom_exception_handler(request, exc)


# Generic message for unhandled exceptions to avoid exposing sensitive details
INTERNAL_SERVER_ERROR_MESSAGE = "An unexpected error occurred. Please try again later."


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle all unhandled exceptions as a catch-all fallback.

    This handler catches any exception that is not handled by other exception
    handlers. It returns a 500 Internal Server Error with a generic message
    to avoid exposing sensitive implementation details to clients.

    The full exception details including stack trace are logged for debugging
    and monitoring purposes, but never exposed in the API response.

    Security note:
        - Stack traces are logged but NOT returned to the client
        - Database errors, file paths, and other sensitive info are hidden
        - Only a generic error message is shown in the response

    Args:
        request: The FastAPI request object.
        exc: The unhandled exception that was raised.

    Returns:
        JSONResponse with 500 status code and ErrorResponse-formatted body
        containing a generic error message.

    Example response:
        {
            "status_code": 500,
            "error_type": "internal_server_error",
            "message": "An unexpected error occurred. Please try again later.",
            "detail": null,
            "request_id": null
        }
    """
    # Log the full exception with stack trace for debugging
    # Always use ERROR level for 500 errors as they indicate unexpected failures
    log_error_with_context(request, exc, log_level=logging.ERROR)

    # Build error response with generic message to avoid exposing sensitive details
    # The actual exception message and stack trace are only in the logs
    error_response = ErrorResponse(
        status_code=500,
        error_type="internal_server_error",
        message=INTERNAL_SERVER_ERROR_MESSAGE,
        detail=None,
        request_id=None,
    )

    return JSONResponse(
        status_code=500,
        content=error_response.model_dump(),
    )


def register_exception_handlers(app: "FastAPI") -> None:
    """Register all exception handlers with a FastAPI application instance.

    This function registers all error handling middleware with the provided
    FastAPI application. It should be called after app creation but before
    router includes.

    The handlers are registered in a specific order to ensure proper exception
    handling priority. More specific exception handlers are registered first,
    with the catch-all unhandled exception handler registered last.

    Registered handlers:
        - RequestValidationError (422): Pydantic validation failures
        - HTTPException (4xx/5xx): FastAPI HTTP exceptions
        - NotFoundError (404): Resource not found
        - ValidationError (400): Business logic validation failure
        - UnauthorizedError (401): Authentication failure
        - ForbiddenError (403): Permission denied
        - DatabaseError (503): Database operation failure
        - BusinessLogicError (422): Domain rule violation
        - Exception (500): Catch-all for unhandled exceptions

    Args:
        app: The FastAPI application instance to register handlers with.

    Usage:
        from fastapi import FastAPI
        from app.middleware import register_exception_handlers

        app = FastAPI()
        register_exception_handlers(app)
        # Then include routers...
        app.include_router(some_router)

    Example:
        >>> from fastapi import FastAPI
        >>> app = FastAPI()
        >>> register_exception_handlers(app)
        >>> # All exception handlers are now registered
    """
    # Register handler for Pydantic request validation errors (422)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)

    # Register handler for FastAPI HTTP exceptions (preserves status codes)
    app.add_exception_handler(HTTPException, http_exception_handler)

    # Register handlers for custom application exceptions
    # Each custom exception has a specific status_code attribute
    app.add_exception_handler(NotFoundError, not_found_error_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(UnauthorizedError, unauthorized_error_handler)
    app.add_exception_handler(ForbiddenError, forbidden_error_handler)
    app.add_exception_handler(DatabaseError, database_error_handler)
    app.add_exception_handler(BusinessLogicError, business_logic_error_handler)

    # Register catch-all handler for any unhandled exceptions (500)
    # This must be registered last to ensure specific handlers take precedence
    app.add_exception_handler(Exception, unhandled_exception_handler)

    logger.info("Exception handlers registered successfully")
