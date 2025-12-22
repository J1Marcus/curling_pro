"""Error handling middleware for FastAPI.

This module provides centralized exception handling with comprehensive logging
and standardized error responses. All exceptions are logged with request context
for debugging and monitoring purposes.
"""

import logging
import traceback
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request

logger = logging.getLogger(__name__)


def log_error_with_context(
    request: "Request",
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


def _get_client_ip(request: "Request") -> str:
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
