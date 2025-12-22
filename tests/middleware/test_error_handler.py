"""
Unit tests for error handling middleware.

This module tests all error handler functions in app/middleware/error_handler.py:
    - log_error_with_context: Logging utility with request context
    - _get_client_ip: Client IP extraction from request headers
    - _format_validation_errors: Pydantic validation error formatting
    - request_validation_error_handler: Handles RequestValidationError (422)
    - http_exception_handler: Handles HTTPException (preserves status codes)
    - custom_exception_handler: Handles custom application exceptions
    - unhandled_exception_handler: Catch-all for unexpected exceptions (500)
    - register_exception_handlers: Registers all handlers with FastAPI app
"""

import logging
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.testclient import TestClient

from app.core.exceptions import (
    BusinessLogicError,
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.middleware.error_handler import (
    INTERNAL_SERVER_ERROR_MESSAGE,
    _format_validation_errors,
    _get_client_ip,
    _get_error_type_from_status_code,
    business_logic_error_handler,
    custom_exception_handler,
    database_error_handler,
    forbidden_error_handler,
    http_exception_handler,
    log_error_with_context,
    not_found_error_handler,
    register_exception_handlers,
    request_validation_error_handler,
    unauthorized_error_handler,
    unhandled_exception_handler,
    validation_error_handler,
)


class TestLogErrorWithContext:
    """Tests for log_error_with_context function."""

    def test_logs_request_path(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the request path in the error message."""
        caplog.set_level(logging.ERROR)
        mock_request.url.path = "/api/users/123"

        log_error_with_context(mock_request, ValueError("Test error"))

        assert "Path:" in caplog.text
        assert "/api/users/123" in caplog.text

    def test_logs_http_method(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the HTTP method in the error message."""
        caplog.set_level(logging.ERROR)
        mock_request.method = "POST"

        log_error_with_context(mock_request, ValueError("Test error"))

        assert "POST" in caplog.text

    def test_logs_client_ip(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the client IP address."""
        caplog.set_level(logging.ERROR)
        mock_request.client.host = "192.168.1.100"

        log_error_with_context(mock_request, ValueError("Test error"))

        assert "Client IP:" in caplog.text

    def test_logs_user_agent(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the user agent from request headers."""
        caplog.set_level(logging.ERROR)

        log_error_with_context(mock_request, ValueError("Test error"))

        assert "User Agent:" in caplog.text
        assert "TestClient/1.0" in caplog.text

    def test_logs_exception_type(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the exception type name."""
        caplog.set_level(logging.ERROR)

        log_error_with_context(mock_request, TypeError("Type mismatch"))

        assert "Exception Type: TypeError" in caplog.text

    def test_logs_exception_message(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the exception message."""
        caplog.set_level(logging.ERROR)
        error_message = "Something went terribly wrong"

        log_error_with_context(mock_request, RuntimeError(error_message))

        assert f"Message: {error_message}" in caplog.text

    def test_logs_stack_trace(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log the full stack trace."""
        caplog.set_level(logging.ERROR)

        try:
            raise ValueError("Error with traceback")
        except ValueError as exc:
            log_error_with_context(mock_request, exc)

        assert "Stack Trace:" in caplog.text
        assert "Traceback" in caplog.text
        assert "ValueError: Error with traceback" in caplog.text

    def test_uses_error_level_by_default(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should use ERROR log level by default."""
        caplog.set_level(logging.ERROR)

        log_error_with_context(mock_request, ValueError("Test error"))

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.ERROR

    def test_uses_custom_log_level(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should use the specified log level when provided."""
        caplog.set_level(logging.WARNING)

        log_error_with_context(
            mock_request, ValueError("Warning error"), log_level=logging.WARNING
        )

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING

    def test_handles_missing_user_agent(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should handle requests without user-agent header."""
        caplog.set_level(logging.ERROR)
        mock_request.headers.get.side_effect = lambda key, default=None: default

        log_error_with_context(mock_request, ValueError("Test error"))

        assert "User Agent: unknown" in caplog.text


class TestGetClientIp:
    """Tests for _get_client_ip helper function."""

    def test_extracts_ip_from_x_forwarded_for(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should extract IP from X-Forwarded-For header."""
        mock_request_with_headers.set_headers(
            {"x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178"}
        )

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "203.0.113.195"

    def test_extracts_single_ip_from_x_forwarded_for(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should extract single IP from X-Forwarded-For header."""
        mock_request_with_headers.set_headers({"x-forwarded-for": "192.168.1.50"})

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "192.168.1.50"

    def test_extracts_ip_from_x_real_ip(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should extract IP from X-Real-IP header when X-Forwarded-For is absent."""
        mock_request_with_headers.set_headers({"x-real-ip": "10.0.0.1"})

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "10.0.0.1"

    def test_prefers_x_forwarded_for_over_x_real_ip(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should prefer X-Forwarded-For over X-Real-IP when both present."""
        mock_request_with_headers.set_headers(
            {"x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2"}
        )

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "1.1.1.1"

    def test_falls_back_to_client_host(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should fall back to request.client.host when no proxy headers."""
        mock_request_with_headers.set_headers({})
        mock_request_with_headers.client.host = "127.0.0.1"

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "127.0.0.1"

    def test_returns_unknown_when_no_client(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should return 'unknown' when client info is not available."""
        mock_request_with_headers.set_headers({})
        mock_request_with_headers.client = None

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "unknown"

    def test_strips_whitespace_from_x_forwarded_for(
        self, mock_request_with_headers: MagicMock
    ) -> None:
        """Should strip whitespace from X-Forwarded-For IP addresses."""
        mock_request_with_headers.set_headers(
            {"x-forwarded-for": "  192.168.1.1  ,  10.0.0.1  "}
        )

        ip = _get_client_ip(mock_request_with_headers)

        assert ip == "192.168.1.1"


class TestFormatValidationErrors:
    """Tests for _format_validation_errors helper function."""

    def test_formats_single_error(self) -> None:
        """Should format a single validation error correctly."""
        errors = [{"loc": ("body", "email"), "msg": "field required", "type": "missing"}]

        result = _format_validation_errors(errors)

        assert result == "body.email: field required (type=missing)"

    def test_formats_multiple_errors(
        self, sample_validation_errors: list[dict[str, Any]]
    ) -> None:
        """Should format multiple validation errors separated by semicolons."""
        result = _format_validation_errors(sample_validation_errors)

        assert "body.email: field required (type=missing)" in result
        assert "body.age: value is not a valid integer (type=int_parsing)" in result
        assert "query.page: value must be greater than 0 (type=greater_than)" in result
        assert result.count(";") == 2

    def test_handles_empty_error_list(self) -> None:
        """Should return empty string for empty error list."""
        result = _format_validation_errors([])

        assert result == ""

    def test_handles_nested_location(self) -> None:
        """Should format deeply nested field locations correctly."""
        errors = [
            {
                "loc": ("body", "user", "profile", "address", "zip_code"),
                "msg": "invalid format",
                "type": "string_type",
            }
        ]

        result = _format_validation_errors(errors)

        assert "body.user.profile.address.zip_code: invalid format" in result

    def test_handles_numeric_location_parts(self) -> None:
        """Should handle numeric indices in location (e.g., for array items)."""
        errors = [{"loc": ("body", "items", 0, "name"), "msg": "required", "type": "missing"}]

        result = _format_validation_errors(errors)

        assert "body.items.0.name: required (type=missing)" in result

    def test_handles_missing_fields(self) -> None:
        """Should use defaults when error dict is missing expected keys."""
        errors = [{"loc": (), "other_key": "value"}]

        result = _format_validation_errors(errors)

        assert "Invalid value" in result
        assert "type=value_error" in result


class TestGetErrorTypeFromStatusCode:
    """Tests for _get_error_type_from_status_code helper function."""

    @pytest.mark.parametrize(
        "status_code,expected_type",
        [
            (400, "bad_request"),
            (401, "unauthorized"),
            (403, "forbidden"),
            (404, "not_found"),
            (405, "method_not_allowed"),
            (409, "conflict"),
            (410, "gone"),
            (422, "unprocessable_entity"),
            (429, "too_many_requests"),
            (500, "internal_server_error"),
            (502, "bad_gateway"),
            (503, "service_unavailable"),
            (504, "gateway_timeout"),
        ],
    )
    def test_maps_known_status_codes(
        self, status_code: int, expected_type: str
    ) -> None:
        """Should map known status codes to their error type strings."""
        result = _get_error_type_from_status_code(status_code)

        assert result == expected_type

    def test_returns_http_error_for_unknown_codes(self) -> None:
        """Should return 'http_error' for unmapped status codes."""
        unknown_codes = [418, 451, 507, 599]

        for code in unknown_codes:
            result = _get_error_type_from_status_code(code)
            assert result == "http_error"


class TestRequestValidationErrorHandler:
    """Tests for request_validation_error_handler."""

    @pytest.fixture
    def validation_error(self) -> RequestValidationError:
        """Create a sample RequestValidationError for testing."""
        errors = [
            {"loc": ("body", "name"), "msg": "field required", "type": "missing"},
            {
                "loc": ("body", "email"),
                "msg": "value is not a valid email address",
                "type": "value_error.email",
            },
        ]
        return RequestValidationError(errors)

    @pytest.mark.asyncio
    async def test_returns_422_status_code(
        self, mock_request: MagicMock, validation_error: RequestValidationError
    ) -> None:
        """Should return 422 Unprocessable Entity status code."""
        response = await request_validation_error_handler(mock_request, validation_error)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_json_response(
        self, mock_request: MagicMock, validation_error: RequestValidationError
    ) -> None:
        """Should return JSONResponse with correct content type."""
        response = await request_validation_error_handler(mock_request, validation_error)

        assert response.media_type == "application/json"

    @pytest.mark.asyncio
    async def test_response_contains_error_type(
        self, mock_request: MagicMock, validation_error: RequestValidationError
    ) -> None:
        """Should include 'validation_error' as error_type."""
        response = await request_validation_error_handler(mock_request, validation_error)
        data = response.body.decode()

        assert '"error_type":"validation_error"' in data

    @pytest.mark.asyncio
    async def test_response_contains_message(
        self, mock_request: MagicMock, validation_error: RequestValidationError
    ) -> None:
        """Should include 'Request validation failed' message."""
        response = await request_validation_error_handler(mock_request, validation_error)
        data = response.body.decode()

        assert "Request validation failed" in data

    @pytest.mark.asyncio
    async def test_response_contains_field_details(
        self, mock_request: MagicMock, validation_error: RequestValidationError
    ) -> None:
        """Should include field-specific validation error details."""
        response = await request_validation_error_handler(mock_request, validation_error)
        data = response.body.decode()

        assert "body.name" in data
        assert "body.email" in data

    @pytest.mark.asyncio
    async def test_logs_at_warning_level(
        self,
        mock_request: MagicMock,
        validation_error: RequestValidationError,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Should log the validation error at WARNING level (4xx error)."""
        caplog.set_level(logging.WARNING)

        await request_validation_error_handler(mock_request, validation_error)

        # Filter for handler logger records
        handler_records = [
            r for r in caplog.records if "error_handler" in r.name
        ]
        assert len(handler_records) >= 1
        assert handler_records[0].levelno == logging.WARNING


class TestHttpExceptionHandler:
    """Tests for http_exception_handler."""

    @pytest.mark.asyncio
    async def test_preserves_status_code(self, mock_request: MagicMock) -> None:
        """Should preserve the original HTTPException status code."""
        exc = HTTPException(status_code=404, detail="User not found")

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_preserves_detail_as_message(self, mock_request: MagicMock) -> None:
        """Should use exception detail as the message."""
        exc = HTTPException(status_code=400, detail="Invalid request parameters")

        response = await http_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert "Invalid request parameters" in data

    @pytest.mark.asyncio
    async def test_maps_status_code_to_error_type(
        self, mock_request: MagicMock
    ) -> None:
        """Should map status code to appropriate error type."""
        exc = HTTPException(status_code=403, detail="Access denied")

        response = await http_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert '"error_type":"forbidden"' in data

    @pytest.mark.asyncio
    async def test_handles_empty_detail(self, mock_request: MagicMock) -> None:
        """Should handle HTTPException without detail."""
        exc = HTTPException(status_code=500)

        response = await http_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert "An error occurred" in data

    @pytest.mark.asyncio
    async def test_logs_4xx_at_warning_level(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log 4xx errors at WARNING level."""
        caplog.set_level(logging.WARNING)
        exc = HTTPException(status_code=404, detail="Not found")

        await http_exception_handler(mock_request, exc)

        handler_records = [r for r in caplog.records if "error_handler" in r.name]
        assert any(r.levelno == logging.WARNING for r in handler_records)

    @pytest.mark.asyncio
    async def test_logs_5xx_at_error_level(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log 5xx errors at ERROR level."""
        caplog.set_level(logging.ERROR)
        exc = HTTPException(status_code=500, detail="Server error")

        await http_exception_handler(mock_request, exc)

        handler_records = [r for r in caplog.records if "error_handler" in r.name]
        assert any(r.levelno == logging.ERROR for r in handler_records)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status_code,expected_type",
        [
            (400, "bad_request"),
            (401, "unauthorized"),
            (404, "not_found"),
            (500, "internal_server_error"),
            (503, "service_unavailable"),
        ],
    )
    async def test_various_status_codes(
        self, mock_request: MagicMock, status_code: int, expected_type: str
    ) -> None:
        """Should correctly handle various HTTP status codes."""
        exc = HTTPException(status_code=status_code, detail="Test error")

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == status_code
        assert expected_type in response.body.decode()


class TestCustomExceptionHandler:
    """Tests for custom_exception_handler (base handler for all custom exceptions)."""

    @pytest.mark.asyncio
    async def test_handles_not_found_error(self, mock_request: MagicMock) -> None:
        """Should handle NotFoundError with 404 status code."""
        exc = NotFoundError(message="Resource not found")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 404
        assert "not_found" in response.body.decode()

    @pytest.mark.asyncio
    async def test_handles_validation_error(self, mock_request: MagicMock) -> None:
        """Should handle ValidationError with 400 status code."""
        exc = ValidationError(message="Invalid data format")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 400
        assert "bad_request" in response.body.decode()

    @pytest.mark.asyncio
    async def test_handles_unauthorized_error(self, mock_request: MagicMock) -> None:
        """Should handle UnauthorizedError with 401 status code."""
        exc = UnauthorizedError(message="Token expired")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 401
        assert "unauthorized" in response.body.decode()

    @pytest.mark.asyncio
    async def test_handles_forbidden_error(self, mock_request: MagicMock) -> None:
        """Should handle ForbiddenError with 403 status code."""
        exc = ForbiddenError(message="Access denied")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 403
        assert "forbidden" in response.body.decode()

    @pytest.mark.asyncio
    async def test_handles_database_error(self, mock_request: MagicMock) -> None:
        """Should handle DatabaseError with 503 status code."""
        exc = DatabaseError(message="Connection failed")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 503
        assert "service_unavailable" in response.body.decode()

    @pytest.mark.asyncio
    async def test_handles_business_logic_error(self, mock_request: MagicMock) -> None:
        """Should handle BusinessLogicError with 422 status code."""
        exc = BusinessLogicError(message="Invalid state transition")

        response = await custom_exception_handler(mock_request, exc)

        assert response.status_code == 422
        assert "unprocessable_entity" in response.body.decode()

    @pytest.mark.asyncio
    async def test_preserves_exception_message(self, mock_request: MagicMock) -> None:
        """Should preserve the exception message in response."""
        custom_message = "User with ID 123 was not found in the system"
        exc = NotFoundError(message=custom_message)

        response = await custom_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert custom_message in data

    @pytest.mark.asyncio
    async def test_logs_4xx_exceptions_at_warning(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log 4xx custom exceptions at WARNING level."""
        caplog.set_level(logging.WARNING)
        exc = NotFoundError(message="Not found")

        await custom_exception_handler(mock_request, exc)

        handler_records = [r for r in caplog.records if "error_handler" in r.name]
        assert any(r.levelno == logging.WARNING for r in handler_records)

    @pytest.mark.asyncio
    async def test_logs_5xx_exceptions_at_error(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log 5xx custom exceptions at ERROR level."""
        caplog.set_level(logging.ERROR)
        exc = DatabaseError(message="Database unavailable")

        await custom_exception_handler(mock_request, exc)

        handler_records = [r for r in caplog.records if "error_handler" in r.name]
        assert any(r.levelno == logging.ERROR for r in handler_records)


class TestWrapperHandlers:
    """Tests for individual exception wrapper handlers."""

    @pytest.mark.asyncio
    async def test_not_found_error_handler(self, mock_request: MagicMock) -> None:
        """not_found_error_handler should delegate to custom_exception_handler."""
        exc = NotFoundError(message="Resource not found")

        response = await not_found_error_handler(mock_request, exc)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_validation_error_handler(self, mock_request: MagicMock) -> None:
        """validation_error_handler should delegate to custom_exception_handler."""
        exc = ValidationError(message="Invalid data")

        response = await validation_error_handler(mock_request, exc)

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_unauthorized_error_handler(self, mock_request: MagicMock) -> None:
        """unauthorized_error_handler should delegate to custom_exception_handler."""
        exc = UnauthorizedError(message="Not authenticated")

        response = await unauthorized_error_handler(mock_request, exc)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_forbidden_error_handler(self, mock_request: MagicMock) -> None:
        """forbidden_error_handler should delegate to custom_exception_handler."""
        exc = ForbiddenError(message="Access denied")

        response = await forbidden_error_handler(mock_request, exc)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_database_error_handler(self, mock_request: MagicMock) -> None:
        """database_error_handler should delegate to custom_exception_handler."""
        exc = DatabaseError(message="Database error")

        response = await database_error_handler(mock_request, exc)

        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_business_logic_error_handler(self, mock_request: MagicMock) -> None:
        """business_logic_error_handler should delegate to custom_exception_handler."""
        exc = BusinessLogicError(message="Business rule violated")

        response = await business_logic_error_handler(mock_request, exc)

        assert response.status_code == 422


class TestUnhandledExceptionHandler:
    """Tests for unhandled_exception_handler (catch-all handler)."""

    @pytest.mark.asyncio
    async def test_returns_500_status_code(self, mock_request: MagicMock) -> None:
        """Should return 500 Internal Server Error for unhandled exceptions."""
        exc = RuntimeError("Unexpected error occurred")

        response = await unhandled_exception_handler(mock_request, exc)

        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_returns_generic_message(self, mock_request: MagicMock) -> None:
        """Should return generic error message, not the actual exception message."""
        exc = RuntimeError("Sensitive database connection string exposed!")

        response = await unhandled_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert INTERNAL_SERVER_ERROR_MESSAGE in data
        assert "Sensitive database" not in data

    @pytest.mark.asyncio
    async def test_returns_internal_server_error_type(
        self, mock_request: MagicMock
    ) -> None:
        """Should return 'internal_server_error' as error type."""
        exc = ValueError("Unexpected value")

        response = await unhandled_exception_handler(mock_request, exc)
        data = response.body.decode()

        assert '"error_type":"internal_server_error"' in data

    @pytest.mark.asyncio
    async def test_logs_at_error_level(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log unhandled exceptions at ERROR level."""
        caplog.set_level(logging.ERROR)
        exc = RuntimeError("Unhandled error")

        await unhandled_exception_handler(mock_request, exc)

        handler_records = [r for r in caplog.records if "error_handler" in r.name]
        assert any(r.levelno == logging.ERROR for r in handler_records)

    @pytest.mark.asyncio
    async def test_logs_full_exception_details(
        self, mock_request: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log full exception details including stack trace."""
        caplog.set_level(logging.ERROR)
        secret_message = "Secret database password: abc123"

        try:
            raise RuntimeError(secret_message)
        except RuntimeError as exc:
            await unhandled_exception_handler(mock_request, exc)

        # Exception details should be in logs (for debugging)
        assert secret_message in caplog.text
        assert "RuntimeError" in caplog.text

    @pytest.mark.asyncio
    async def test_does_not_expose_sensitive_info(
        self, mock_request: MagicMock
    ) -> None:
        """Should not expose sensitive error details in response."""
        sensitive_errors = [
            RuntimeError("psycopg2.OperationalError: connection refused"),
            IOError("/etc/passwd: permission denied"),
            Exception("SECRET_API_KEY=sk-live-xxx"),
        ]

        for exc in sensitive_errors:
            response = await unhandled_exception_handler(mock_request, exc)
            data = response.body.decode()

            assert "psycopg2" not in data
            assert "/etc/passwd" not in data
            assert "SECRET_API_KEY" not in data
            assert INTERNAL_SERVER_ERROR_MESSAGE in data

    @pytest.mark.asyncio
    async def test_handles_exception_subclasses(self, mock_request: MagicMock) -> None:
        """Should handle any Exception subclass."""
        class CustomInternalError(Exception):
            pass

        exc = CustomInternalError("Custom internal error")

        response = await unhandled_exception_handler(mock_request, exc)

        assert response.status_code == 500


class TestRegisterExceptionHandlers:
    """Tests for register_exception_handlers function."""

    def test_registers_all_handlers(self) -> None:
        """Should register all exception handlers with the app."""
        app = FastAPI()

        register_exception_handlers(app)

        # Check that handlers are registered for expected exception types
        assert RequestValidationError in app.exception_handlers
        assert HTTPException in app.exception_handlers
        assert NotFoundError in app.exception_handlers
        assert ValidationError in app.exception_handlers
        assert UnauthorizedError in app.exception_handlers
        assert ForbiddenError in app.exception_handlers
        assert DatabaseError in app.exception_handlers
        assert BusinessLogicError in app.exception_handlers
        assert Exception in app.exception_handlers

    def test_logs_successful_registration(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Should log when exception handlers are registered successfully."""
        caplog.set_level(logging.INFO)
        app = FastAPI()

        register_exception_handlers(app)

        assert "Exception handlers registered successfully" in caplog.text

    def test_app_handles_validation_error_after_registration(self) -> None:
        """App should return 422 for validation errors after registration."""
        from pydantic import BaseModel

        app = FastAPI()
        register_exception_handlers(app)

        class RequestBody(BaseModel):
            name: str
            age: int

        @app.post("/test")
        def test_endpoint(body: RequestBody) -> dict:
            return {"name": body.name}

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/test", json={"name": "Test"})  # Missing 'age'

            assert response.status_code == 422
            assert response.json()["error_type"] == "validation_error"

    def test_app_handles_http_exception_after_registration(self) -> None:
        """App should return proper error response for HTTPException after registration."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/test")
        def test_endpoint() -> dict:
            raise HTTPException(status_code=404, detail="Item not found")

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/test")

            assert response.status_code == 404
            assert response.json()["error_type"] == "not_found"
            assert "Item not found" in response.json()["message"]

    def test_app_handles_custom_exception_after_registration(self) -> None:
        """App should return proper error response for custom exceptions after registration."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/test")
        def test_endpoint() -> dict:
            raise NotFoundError(message="User not found")

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/test")

            assert response.status_code == 404
            assert "User not found" in response.json()["message"]

    def test_app_handles_unhandled_exception_after_registration(self) -> None:
        """App should return 500 for unhandled exceptions after registration."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/test")
        def test_endpoint() -> dict:
            raise RuntimeError("Unexpected error")

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/test")

            assert response.status_code == 500
            assert response.json()["error_type"] == "internal_server_error"
            # Should NOT contain the actual error message
            assert "Unexpected error" not in response.json()["message"]


class TestErrorResponseConsistency:
    """Tests verifying consistent error response format across all handlers."""

    def test_all_handlers_return_consistent_schema(self, test_app: FastAPI) -> None:
        """All error responses should follow the ErrorResponse schema."""
        required_fields = {"status_code", "error_type", "message", "detail", "request_id"}

        @test_app.get("/validation-error")
        def trigger_validation() -> dict:
            from pydantic import BaseModel

            class Model(BaseModel):
                field: str

            Model()  # type: ignore[call-arg]
            return {}

        @test_app.get("/http-error")
        def trigger_http() -> dict:
            raise HTTPException(status_code=400, detail="Bad request")

        @test_app.get("/not-found")
        def trigger_not_found() -> dict:
            raise NotFoundError(message="Not found")

        @test_app.get("/unhandled")
        def trigger_unhandled() -> dict:
            raise RuntimeError("Unhandled")

        with TestClient(test_app, raise_server_exceptions=False) as client:
            endpoints = ["/http-error", "/not-found", "/unhandled"]

            for endpoint in endpoints:
                response = client.get(endpoint)
                data = response.json()

                assert set(data.keys()) == required_fields, (
                    f"Endpoint {endpoint} response missing fields"
                )

    def test_status_code_in_response_body_matches_http_status(
        self, test_app: FastAPI
    ) -> None:
        """status_code in response body should match HTTP response status."""

        @test_app.get("/error-{code}")
        def trigger_error(code: int) -> dict:
            raise HTTPException(status_code=code, detail="Error")

        with TestClient(test_app, raise_server_exceptions=False) as client:
            for code in [400, 401, 403, 404, 500, 503]:
                response = client.get(f"/error-{code}")

                assert response.status_code == code
                assert response.json()["status_code"] == code
