"""
Pytest configuration and shared fixtures for Everbound Backend tests.

This module provides common test fixtures used across the test suite,
including FastAPI TestClient, mock request objects, and logging capture
utilities.

Fixtures:
    test_client: FastAPI TestClient for integration testing
    mock_request: Mock FastAPI Request object for unit testing handlers
    caplog_with_handler: Enhanced log capturing with handler-level access
"""

import logging
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from app.main import app as fastapi_app
from app.middleware import register_exception_handlers


@pytest.fixture
def test_client() -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient for integration testing.

    This fixture creates a TestClient instance connected to the main
    FastAPI application, allowing tests to make HTTP requests to the
    API endpoints.

    Yields:
        TestClient: A configured test client for the FastAPI app.

    Example:
        def test_get_endpoint(test_client):
            response = test_client.get("/some-endpoint")
            assert response.status_code == 200
    """
    with TestClient(fastapi_app) as client:
        yield client


@pytest.fixture
def test_app() -> FastAPI:
    """Provide a clean FastAPI app instance for testing.

    This fixture creates a new FastAPI instance with exception handlers
    registered, useful for testing middleware components in isolation
    without affecting the main application.

    Returns:
        FastAPI: A fresh FastAPI application instance with error handlers.

    Example:
        def test_app_with_custom_routes(test_app):
            @test_app.get("/test")
            def test_route():
                return {"message": "test"}

            with TestClient(test_app) as client:
                response = client.get("/test")
                assert response.status_code == 200
    """
    app = FastAPI()
    register_exception_handlers(app)
    return app


@pytest.fixture
def test_app_client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    """Provide a TestClient for a clean test app instance.

    This fixture combines test_app with a TestClient, useful for testing
    middleware behavior with custom routes.

    Args:
        test_app: The clean FastAPI app fixture.

    Yields:
        TestClient: A configured test client for the test app.
    """
    with TestClient(test_app) as client:
        yield client


@pytest.fixture
def mock_request() -> MagicMock:
    """Provide a mock FastAPI Request object for unit testing.

    This fixture creates a MagicMock that mimics FastAPI's Request object,
    pre-configured with common attributes needed for testing exception
    handlers and middleware functions.

    The mock includes:
        - url.path: Request path (default: "/test-endpoint")
        - method: HTTP method (default: "GET")
        - headers: Dict-like object for request headers
        - client.host: Client IP address (default: "127.0.0.1")

    Returns:
        MagicMock: A mock Request object with pre-configured attributes.

    Example:
        def test_error_handler(mock_request):
            mock_request.url.path = "/custom/path"
            mock_request.method = "POST"
            # Use mock_request in handler tests
    """
    mock = MagicMock()

    # Configure URL
    mock.url.path = "/test-endpoint"

    # Configure HTTP method
    mock.method = "GET"

    # Configure headers with dict-like behavior
    headers_dict: dict[str, str] = {
        "user-agent": "TestClient/1.0",
        "content-type": "application/json",
    }
    mock.headers.get.side_effect = lambda key, default=None: headers_dict.get(
        key.lower(), default
    )
    mock.headers.__getitem__.side_effect = lambda key: headers_dict.get(key.lower(), "")
    mock.headers.__contains__.side_effect = lambda key: key.lower() in headers_dict

    # Configure client info
    mock.client.host = "127.0.0.1"

    return mock


@pytest.fixture
def mock_request_with_headers() -> MagicMock:
    """Provide a mock Request with customizable headers.

    This fixture provides a factory function that creates mock Request
    objects with specific header configurations. Useful for testing
    proxy headers (X-Forwarded-For, X-Real-IP) and other header-dependent
    functionality.

    Returns:
        MagicMock: A function that creates configured mock Request objects.

    Example:
        def test_client_ip_extraction(mock_request_with_headers):
            request = mock_request_with_headers
            request.headers = {"x-forwarded-for": "192.168.1.100"}
            # Test with custom headers
    """
    mock = MagicMock()
    mock.url.path = "/test-endpoint"
    mock.method = "GET"
    mock.client.host = "127.0.0.1"

    # Default empty headers that can be customized
    _headers: dict[str, str] = {}

    def set_headers(headers: dict[str, str]) -> None:
        """Update the mock's headers."""
        _headers.clear()
        _headers.update({k.lower(): v for k, v in headers.items()})
        mock.headers.get.side_effect = lambda key, default=None: _headers.get(
            key.lower(), default
        )

    mock.set_headers = set_headers
    mock.headers.get.side_effect = lambda key, default=None: _headers.get(
        key.lower(), default
    )

    return mock


class LogCapture:
    """Helper class for capturing and asserting log messages.

    This class provides a more ergonomic interface for working with
    captured log records during testing.

    Attributes:
        records: List of captured LogRecord objects.

    Example:
        log_capture = LogCapture(caplog.records)
        assert log_capture.has_message("Error occurred")
        assert log_capture.has_level(logging.ERROR)
    """

    def __init__(self, records: list[logging.LogRecord]) -> None:
        """Initialize with a list of log records.

        Args:
            records: List of LogRecord objects from caplog.
        """
        self.records = records

    def has_message(self, substring: str) -> bool:
        """Check if any log message contains the given substring.

        Args:
            substring: Text to search for in log messages.

        Returns:
            True if any log message contains the substring.
        """
        return any(substring in record.message for record in self.records)

    def has_level(self, level: int) -> bool:
        """Check if any log was captured at the specified level.

        Args:
            level: Logging level (e.g., logging.ERROR, logging.WARNING).

        Returns:
            True if any log was captured at the specified level.
        """
        return any(record.levelno == level for record in self.records)

    def get_messages(self, level: int | None = None) -> list[str]:
        """Get all captured log messages, optionally filtered by level.

        Args:
            level: Optional logging level to filter by.

        Returns:
            List of log message strings.
        """
        if level is not None:
            return [r.message for r in self.records if r.levelno == level]
        return [r.message for r in self.records]

    def get_records_by_level(self, level: int) -> list[logging.LogRecord]:
        """Get all log records at a specific level.

        Args:
            level: Logging level to filter by.

        Returns:
            List of LogRecord objects at the specified level.
        """
        return [r for r in self.records if r.levelno == level]

    def count(self, level: int | None = None) -> int:
        """Count captured log records, optionally filtered by level.

        Args:
            level: Optional logging level to filter by.

        Returns:
            Number of matching log records.
        """
        if level is not None:
            return len([r for r in self.records if r.levelno == level])
        return len(self.records)

    def clear(self) -> None:
        """Clear all captured records."""
        self.records.clear()


@pytest.fixture
def log_capture(caplog: pytest.LogCaptureFixture) -> LogCapture:
    """Provide enhanced log capturing functionality.

    This fixture wraps pytest's caplog with a LogCapture helper class
    that provides more ergonomic methods for asserting log behavior.

    Args:
        caplog: pytest's built-in log capture fixture.

    Returns:
        LogCapture: A helper object for working with captured logs.

    Example:
        def test_error_logging(log_capture, caplog):
            caplog.set_level(logging.ERROR)
            # ... trigger some logging ...
            assert log_capture.has_message("Error occurred")
            assert log_capture.has_level(logging.ERROR)
    """
    return LogCapture(caplog.records)


@pytest.fixture
def capture_error_logs(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    """Configure log capture for error-level logging.

    This fixture configures caplog to capture ERROR and above level logs,
    which is useful for testing exception handlers that log errors.

    Args:
        caplog: pytest's built-in log capture fixture.

    Returns:
        LogCaptureFixture: Configured to capture ERROR level logs.

    Example:
        def test_unhandled_exception(capture_error_logs):
            # ... trigger error ...
            assert "Exception occurred" in capture_error_logs.text
    """
    caplog.set_level(logging.ERROR)
    return caplog


@pytest.fixture
def capture_warning_logs(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    """Configure log capture for warning-level logging.

    This fixture configures caplog to capture WARNING and above level logs,
    which is useful for testing 4xx error handlers that log warnings.

    Args:
        caplog: pytest's built-in log capture fixture.

    Returns:
        LogCaptureFixture: Configured to capture WARNING level logs.

    Example:
        def test_validation_error(capture_warning_logs):
            # ... trigger validation error ...
            assert "validation failed" in capture_warning_logs.text
    """
    caplog.set_level(logging.WARNING)
    return caplog


@pytest.fixture
def capture_all_logs(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    """Configure log capture for all logging levels.

    This fixture configures caplog to capture DEBUG and above level logs,
    allowing tests to verify all logged messages.

    Args:
        caplog: pytest's built-in log capture fixture.

    Returns:
        LogCaptureFixture: Configured to capture all log levels.

    Example:
        def test_detailed_logging(capture_all_logs):
            # ... run code with logging ...
            assert len(capture_all_logs.records) > 0
    """
    caplog.set_level(logging.DEBUG)
    return caplog


@pytest.fixture
def sample_validation_errors() -> list[dict[str, Any]]:
    """Provide sample Pydantic validation errors for testing.

    This fixture provides a list of validation error dictionaries in the
    format returned by Pydantic's ValidationError.errors() method.

    Returns:
        List of validation error dictionaries.

    Example:
        def test_format_validation_errors(sample_validation_errors):
            formatted = _format_validation_errors(sample_validation_errors)
            assert "email" in formatted
    """
    return [
        {
            "loc": ("body", "email"),
            "msg": "field required",
            "type": "missing",
        },
        {
            "loc": ("body", "age"),
            "msg": "value is not a valid integer",
            "type": "int_parsing",
        },
        {
            "loc": ("query", "page"),
            "msg": "value must be greater than 0",
            "type": "greater_than",
        },
    ]
