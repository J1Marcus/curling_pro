"""
Integration tests for API error handling through actual endpoints.

This module tests error handling middleware behavior through real HTTP requests
to API endpoints, verifying that:
    - Validation errors return 422 with field-specific details
    - Custom exceptions return correct status codes and messages
    - HTTP exceptions preserve status codes and messages
    - Unhandled exceptions return 500 with generic message (no sensitive data exposure)
    - All error responses follow the ErrorResponse schema format
"""

import logging
from collections.abc import Generator
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from starlette.testclient import TestClient

from app.core.exceptions import (
    BusinessLogicError,
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.middleware import register_exception_handlers
from app.middleware.error_handler import INTERNAL_SERVER_ERROR_MESSAGE


# Expected fields in all ErrorResponse responses
ERROR_RESPONSE_FIELDS = {"status_code", "error_type", "message", "detail", "request_id"}


class TestValidationErrorIntegration:
    """Integration tests for validation error responses (422)."""

    @pytest.fixture
    def app_with_validation_endpoint(self) -> FastAPI:
        """Create a FastAPI app with an endpoint that requires validation."""
        app = FastAPI()
        register_exception_handlers(app)

        class UserCreateRequest(BaseModel):
            name: str
            email: str
            age: int

        @app.post("/users")
        def create_user(user: UserCreateRequest) -> dict[str, Any]:
            return {"id": 1, "name": user.name, "email": user.email, "age": user.age}

        return app

    @pytest.fixture
    def validation_client(
        self, app_with_validation_endpoint: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the validation test app."""
        with TestClient(app_with_validation_endpoint, raise_server_exceptions=False) as client:
            yield client

    def test_missing_required_field_returns_422(
        self, validation_client: TestClient
    ) -> None:
        """POST with missing required field should return 422."""
        response = validation_client.post(
            "/users",
            json={"name": "John", "email": "john@example.com"},  # Missing 'age'
        )

        assert response.status_code == 422

    def test_validation_error_response_follows_schema(
        self, validation_client: TestClient
    ) -> None:
        """Validation error response should follow ErrorResponse schema."""
        response = validation_client.post("/users", json={})  # Missing all fields

        assert response.status_code == 422
        data = response.json()

        # Verify all expected fields are present
        assert set(data.keys()) == ERROR_RESPONSE_FIELDS

    def test_validation_error_has_correct_error_type(
        self, validation_client: TestClient
    ) -> None:
        """Validation error should have error_type 'validation_error'."""
        response = validation_client.post("/users", json={"name": 123})

        assert response.status_code == 422
        assert response.json()["error_type"] == "validation_error"

    def test_validation_error_includes_field_details(
        self, validation_client: TestClient
    ) -> None:
        """Validation error should include field-specific details."""
        response = validation_client.post(
            "/users",
            json={"name": "John"},  # Missing email and age
        )

        assert response.status_code == 422
        data = response.json()

        # Check that field details are in the response
        assert "detail" in data
        detail = data["detail"]
        assert "email" in detail
        assert "age" in detail

    def test_validation_error_with_wrong_type(
        self, validation_client: TestClient
    ) -> None:
        """Validation error for wrong type should return 422 with type info."""
        response = validation_client.post(
            "/users",
            json={"name": "John", "email": "john@example.com", "age": "not-a-number"},
        )

        assert response.status_code == 422
        data = response.json()

        assert "age" in data["detail"]
        assert "int" in data["detail"].lower() or "type" in data["detail"].lower()

    def test_validation_error_status_code_in_body_matches_response(
        self, validation_client: TestClient
    ) -> None:
        """status_code in response body should match HTTP response status."""
        response = validation_client.post("/users", json={})

        assert response.status_code == 422
        assert response.json()["status_code"] == 422

    def test_validation_error_message_is_descriptive(
        self, validation_client: TestClient
    ) -> None:
        """Validation error message should be descriptive."""
        response = validation_client.post("/users", json={})

        assert response.status_code == 422
        message = response.json()["message"]

        # Message should mention validation failure
        assert "validation" in message.lower()


class TestCustomExceptionIntegration:
    """Integration tests for custom exception responses."""

    @pytest.fixture
    def app_with_custom_exceptions(self) -> FastAPI:
        """Create a FastAPI app with endpoints that raise custom exceptions."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/not-found")
        def trigger_not_found() -> dict[str, Any]:
            raise NotFoundError(message="The requested item was not found")

        @app.get("/validation-error")
        def trigger_validation_error() -> dict[str, Any]:
            raise ValidationError(message="Invalid input format")

        @app.get("/unauthorized")
        def trigger_unauthorized() -> dict[str, Any]:
            raise UnauthorizedError(message="Authentication token expired")

        @app.get("/forbidden")
        def trigger_forbidden() -> dict[str, Any]:
            raise ForbiddenError(message="You do not have permission to access this")

        @app.get("/database-error")
        def trigger_database_error() -> dict[str, Any]:
            raise DatabaseError(message="Database connection failed")

        @app.get("/business-logic-error")
        def trigger_business_logic_error() -> dict[str, Any]:
            raise BusinessLogicError(message="Cannot cancel an already shipped order")

        return app

    @pytest.fixture
    def custom_exception_client(
        self, app_with_custom_exceptions: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the custom exception test app."""
        with TestClient(app_with_custom_exceptions, raise_server_exceptions=False) as client:
            yield client

    def test_not_found_error_returns_404(
        self, custom_exception_client: TestClient
    ) -> None:
        """NotFoundError should return 404 status code."""
        response = custom_exception_client.get("/not-found")

        assert response.status_code == 404
        assert response.json()["error_type"] == "not_found"
        assert "not found" in response.json()["message"].lower()

    def test_validation_error_returns_400(
        self, custom_exception_client: TestClient
    ) -> None:
        """Custom ValidationError should return 400 status code."""
        response = custom_exception_client.get("/validation-error")

        assert response.status_code == 400
        assert response.json()["error_type"] == "bad_request"
        assert "Invalid input format" in response.json()["message"]

    def test_unauthorized_error_returns_401(
        self, custom_exception_client: TestClient
    ) -> None:
        """UnauthorizedError should return 401 status code."""
        response = custom_exception_client.get("/unauthorized")

        assert response.status_code == 401
        assert response.json()["error_type"] == "unauthorized"
        assert "token expired" in response.json()["message"].lower()

    def test_forbidden_error_returns_403(
        self, custom_exception_client: TestClient
    ) -> None:
        """ForbiddenError should return 403 status code."""
        response = custom_exception_client.get("/forbidden")

        assert response.status_code == 403
        assert response.json()["error_type"] == "forbidden"
        assert "permission" in response.json()["message"].lower()

    def test_database_error_returns_503(
        self, custom_exception_client: TestClient
    ) -> None:
        """DatabaseError should return 503 status code."""
        response = custom_exception_client.get("/database-error")

        assert response.status_code == 503
        assert response.json()["error_type"] == "service_unavailable"

    def test_business_logic_error_returns_422(
        self, custom_exception_client: TestClient
    ) -> None:
        """BusinessLogicError should return 422 status code."""
        response = custom_exception_client.get("/business-logic-error")

        assert response.status_code == 422
        assert response.json()["error_type"] == "unprocessable_entity"
        assert "shipped order" in response.json()["message"].lower()

    def test_custom_exception_response_follows_schema(
        self, custom_exception_client: TestClient
    ) -> None:
        """All custom exception responses should follow ErrorResponse schema."""
        endpoints = [
            "/not-found",
            "/validation-error",
            "/unauthorized",
            "/forbidden",
            "/database-error",
            "/business-logic-error",
        ]

        for endpoint in endpoints:
            response = custom_exception_client.get(endpoint)
            data = response.json()

            assert set(data.keys()) == ERROR_RESPONSE_FIELDS, (
                f"Response for {endpoint} missing expected fields"
            )

    def test_custom_exception_preserves_message(
        self, custom_exception_client: TestClient
    ) -> None:
        """Custom exception message should be preserved in response."""
        response = custom_exception_client.get("/not-found")

        assert "The requested item was not found" in response.json()["message"]

    def test_custom_exception_status_code_in_body_matches_response(
        self, custom_exception_client: TestClient
    ) -> None:
        """status_code in response body should match HTTP response status."""
        test_cases = [
            ("/not-found", 404),
            ("/validation-error", 400),
            ("/unauthorized", 401),
            ("/forbidden", 403),
            ("/database-error", 503),
            ("/business-logic-error", 422),
        ]

        for endpoint, expected_status in test_cases:
            response = custom_exception_client.get(endpoint)

            assert response.status_code == expected_status
            assert response.json()["status_code"] == expected_status


class TestHTTPExceptionIntegration:
    """Integration tests for FastAPI HTTPException responses."""

    @pytest.fixture
    def app_with_http_exceptions(self) -> FastAPI:
        """Create a FastAPI app with endpoints that raise HTTPException."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/bad-request")
        def trigger_bad_request() -> dict[str, Any]:
            raise HTTPException(status_code=400, detail="Invalid query parameters")

        @app.get("/not-found")
        def trigger_not_found() -> dict[str, Any]:
            raise HTTPException(status_code=404, detail="Resource not found")

        @app.get("/method-not-allowed")
        def trigger_method_not_allowed() -> dict[str, Any]:
            raise HTTPException(status_code=405, detail="Method not allowed")

        @app.get("/conflict")
        def trigger_conflict() -> dict[str, Any]:
            raise HTTPException(status_code=409, detail="Resource already exists")

        @app.get("/server-error")
        def trigger_server_error() -> dict[str, Any]:
            raise HTTPException(status_code=500, detail="Internal server error")

        @app.get("/service-unavailable")
        def trigger_service_unavailable() -> dict[str, Any]:
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")

        @app.get("/no-detail")
        def trigger_no_detail() -> dict[str, Any]:
            raise HTTPException(status_code=400)

        return app

    @pytest.fixture
    def http_exception_client(
        self, app_with_http_exceptions: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the HTTP exception test app."""
        with TestClient(app_with_http_exceptions, raise_server_exceptions=False) as client:
            yield client

    def test_http_exception_preserves_status_code(
        self, http_exception_client: TestClient
    ) -> None:
        """HTTPException status code should be preserved."""
        test_cases = [
            ("/bad-request", 400),
            ("/not-found", 404),
            ("/method-not-allowed", 405),
            ("/conflict", 409),
            ("/server-error", 500),
            ("/service-unavailable", 503),
        ]

        for endpoint, expected_status in test_cases:
            response = http_exception_client.get(endpoint)

            assert response.status_code == expected_status

    def test_http_exception_preserves_detail_message(
        self, http_exception_client: TestClient
    ) -> None:
        """HTTPException detail should be preserved in message."""
        response = http_exception_client.get("/bad-request")

        assert response.status_code == 400
        assert "Invalid query parameters" in response.json()["message"]

    def test_http_exception_maps_error_type_correctly(
        self, http_exception_client: TestClient
    ) -> None:
        """HTTPException should map status code to correct error_type."""
        test_cases = [
            ("/bad-request", "bad_request"),
            ("/not-found", "not_found"),
            ("/method-not-allowed", "method_not_allowed"),
            ("/conflict", "conflict"),
            ("/server-error", "internal_server_error"),
            ("/service-unavailable", "service_unavailable"),
        ]

        for endpoint, expected_error_type in test_cases:
            response = http_exception_client.get(endpoint)
            data = response.json()

            assert data["error_type"] == expected_error_type, (
                f"Expected error_type '{expected_error_type}' for {endpoint}, "
                f"got '{data['error_type']}'"
            )

    def test_http_exception_response_follows_schema(
        self, http_exception_client: TestClient
    ) -> None:
        """HTTPException responses should follow ErrorResponse schema."""
        response = http_exception_client.get("/bad-request")
        data = response.json()

        assert set(data.keys()) == ERROR_RESPONSE_FIELDS

    def test_http_exception_without_detail_has_default_message(
        self, http_exception_client: TestClient
    ) -> None:
        """HTTPException without detail should have a default message."""
        response = http_exception_client.get("/no-detail")

        assert response.status_code == 400
        data = response.json()

        # Should have a message even without detail
        assert data["message"]
        assert len(data["message"]) > 0

    def test_http_exception_status_code_in_body_matches_response(
        self, http_exception_client: TestClient
    ) -> None:
        """status_code in response body should match HTTP response status."""
        response = http_exception_client.get("/not-found")

        assert response.status_code == 404
        assert response.json()["status_code"] == 404


class TestUnhandledExceptionIntegration:
    """Integration tests for unhandled exception responses (500)."""

    @pytest.fixture
    def app_with_unhandled_exceptions(self) -> FastAPI:
        """Create a FastAPI app with endpoints that raise unhandled exceptions."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/runtime-error")
        def trigger_runtime_error() -> dict[str, Any]:
            raise RuntimeError("Unexpected runtime error occurred")

        @app.get("/value-error")
        def trigger_value_error() -> dict[str, Any]:
            raise ValueError("Invalid value provided")

        @app.get("/type-error")
        def trigger_type_error() -> dict[str, Any]:
            raise TypeError("Type mismatch in operation")

        @app.get("/division-by-zero")
        def trigger_division_error() -> dict[str, Any]:
            return {"result": 1 / 0}  # Will raise ZeroDivisionError

        @app.get("/sensitive-error")
        def trigger_sensitive_error() -> dict[str, Any]:
            raise RuntimeError(
                "Connection failed: psycopg2.OperationalError: "
                "FATAL: password authentication failed for user 'admin'"
            )

        @app.get("/file-path-error")
        def trigger_file_path_error() -> dict[str, Any]:
            raise IOError("/var/secrets/api_key.txt: Permission denied")

        @app.get("/api-key-error")
        def trigger_api_key_error() -> dict[str, Any]:
            raise RuntimeError("API call failed: SECRET_KEY=sk-live-abc123xyz")

        return app

    @pytest.fixture
    def unhandled_exception_client(
        self, app_with_unhandled_exceptions: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the unhandled exception test app."""
        with TestClient(app_with_unhandled_exceptions, raise_server_exceptions=False) as client:
            yield client

    def test_unhandled_exception_returns_500(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should return 500 status code."""
        endpoints = [
            "/runtime-error",
            "/value-error",
            "/type-error",
            "/division-by-zero",
        ]

        for endpoint in endpoints:
            response = unhandled_exception_client.get(endpoint)
            assert response.status_code == 500, f"Expected 500 for {endpoint}"

    def test_unhandled_exception_returns_generic_message(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should return a generic message."""
        response = unhandled_exception_client.get("/runtime-error")

        assert response.status_code == 500
        assert response.json()["message"] == INTERNAL_SERVER_ERROR_MESSAGE

    def test_unhandled_exception_has_correct_error_type(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should have error_type 'internal_server_error'."""
        response = unhandled_exception_client.get("/runtime-error")

        assert response.status_code == 500
        assert response.json()["error_type"] == "internal_server_error"

    def test_unhandled_exception_response_follows_schema(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exception responses should follow ErrorResponse schema."""
        response = unhandled_exception_client.get("/runtime-error")
        data = response.json()

        assert set(data.keys()) == ERROR_RESPONSE_FIELDS

    def test_unhandled_exception_does_not_expose_error_message(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should NOT expose the actual error message."""
        response = unhandled_exception_client.get("/runtime-error")
        data = response.json()

        # The actual error message should NOT appear in the response
        assert "Unexpected runtime error" not in data["message"]
        assert "Unexpected runtime error" not in str(data.get("detail") or "")

    def test_unhandled_exception_does_not_expose_sensitive_db_info(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should NOT expose database connection details."""
        response = unhandled_exception_client.get("/sensitive-error")
        data = response.json()
        response_str = str(data)

        # Sensitive information should NOT be in the response
        assert "psycopg2" not in response_str
        assert "password" not in response_str
        assert "admin" not in response_str.lower() or "admin" in INTERNAL_SERVER_ERROR_MESSAGE.lower()

    def test_unhandled_exception_does_not_expose_file_paths(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should NOT expose file system paths."""
        response = unhandled_exception_client.get("/file-path-error")
        data = response.json()
        response_str = str(data)

        # File paths should NOT be in the response
        assert "/var/secrets" not in response_str
        assert "api_key.txt" not in response_str

    def test_unhandled_exception_does_not_expose_api_keys(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """Unhandled exceptions should NOT expose API keys or secrets."""
        response = unhandled_exception_client.get("/api-key-error")
        data = response.json()
        response_str = str(data)

        # API keys and secrets should NOT be in the response
        assert "SECRET_KEY" not in response_str
        assert "sk-live" not in response_str

    def test_unhandled_exception_status_code_in_body_matches_response(
        self, unhandled_exception_client: TestClient
    ) -> None:
        """status_code in response body should match HTTP response status."""
        response = unhandled_exception_client.get("/runtime-error")

        assert response.status_code == 500
        assert response.json()["status_code"] == 500


class TestErrorLoggingIntegration:
    """Integration tests verifying that errors are logged correctly."""

    @pytest.fixture
    def app_with_logging_endpoints(self) -> FastAPI:
        """Create a FastAPI app with endpoints for logging tests."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/log-not-found")
        def trigger_not_found_for_log() -> dict[str, Any]:
            raise NotFoundError(message="Resource XYZ not found")

        @app.get("/log-unhandled")
        def trigger_unhandled_for_log() -> dict[str, Any]:
            raise RuntimeError("Critical failure in processing")

        @app.get("/log-validation")
        def trigger_validation_for_log() -> dict[str, Any]:
            from pydantic import BaseModel

            class StrictModel(BaseModel):
                required_field: str

            StrictModel()  # type: ignore[call-arg]
            return {}

        return app

    @pytest.fixture
    def logging_client(
        self, app_with_logging_endpoints: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the logging test app."""
        with TestClient(app_with_logging_endpoints, raise_server_exceptions=False) as client:
            yield client

    def test_4xx_errors_logged_at_warning_level(
        self,
        logging_client: TestClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """4xx errors should be logged at WARNING level."""
        caplog.set_level(logging.WARNING)

        logging_client.get("/log-not-found")

        # Check for WARNING level logs from error handler
        warning_logs = [
            r for r in caplog.records
            if r.levelno == logging.WARNING and "error_handler" in r.name
        ]
        assert len(warning_logs) >= 1

    def test_5xx_errors_logged_at_error_level(
        self,
        logging_client: TestClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """5xx errors should be logged at ERROR level."""
        caplog.set_level(logging.ERROR)

        logging_client.get("/log-unhandled")

        # Check for ERROR level logs from error handler
        error_logs = [
            r for r in caplog.records
            if r.levelno == logging.ERROR and "error_handler" in r.name
        ]
        assert len(error_logs) >= 1

    def test_logs_contain_request_path(
        self,
        logging_client: TestClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Error logs should contain the request path."""
        caplog.set_level(logging.WARNING)

        logging_client.get("/log-not-found")

        assert "/log-not-found" in caplog.text

    def test_logs_contain_exception_type(
        self,
        logging_client: TestClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Error logs should contain the exception type."""
        caplog.set_level(logging.WARNING)

        logging_client.get("/log-not-found")

        assert "NotFoundError" in caplog.text

    def test_unhandled_error_logs_contain_full_details(
        self,
        logging_client: TestClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Unhandled error logs should contain full exception details for debugging."""
        caplog.set_level(logging.ERROR)

        logging_client.get("/log-unhandled")

        # The actual error message should be in the logs (for debugging)
        assert "Critical failure in processing" in caplog.text
        assert "RuntimeError" in caplog.text


class TestResponseContentType:
    """Integration tests verifying correct response content types."""

    @pytest.fixture
    def app_with_error_endpoints(self) -> FastAPI:
        """Create a FastAPI app with error endpoints."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/error")
        def trigger_error() -> dict[str, Any]:
            raise HTTPException(status_code=400, detail="Test error")

        return app

    @pytest.fixture
    def content_type_client(
        self, app_with_error_endpoints: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for content type testing."""
        with TestClient(app_with_error_endpoints, raise_server_exceptions=False) as client:
            yield client

    def test_error_response_has_json_content_type(
        self, content_type_client: TestClient
    ) -> None:
        """Error responses should have application/json content type."""
        response = content_type_client.get("/error")

        assert response.status_code == 400
        assert "application/json" in response.headers.get("content-type", "")


class TestConsistentErrorFormat:
    """Integration tests verifying consistent error format across all error types."""

    @pytest.fixture
    def comprehensive_error_app(self) -> FastAPI:
        """Create a FastAPI app with all error types for format testing."""
        app = FastAPI()
        register_exception_handlers(app)

        class RequiredFields(BaseModel):
            field1: str
            field2: int

        @app.post("/validation")
        def validation_endpoint(data: RequiredFields) -> dict[str, Any]:
            return {"data": data.model_dump()}

        @app.get("/custom/{error_type}")
        def custom_exception_endpoint(error_type: str) -> dict[str, Any]:
            exceptions = {
                "not_found": NotFoundError(message="Not found"),
                "validation": ValidationError(message="Invalid"),
                "unauthorized": UnauthorizedError(message="Unauthorized"),
                "forbidden": ForbiddenError(message="Forbidden"),
                "database": DatabaseError(message="DB Error"),
                "business": BusinessLogicError(message="Business error"),
            }
            if error_type in exceptions:
                raise exceptions[error_type]
            return {"error": "unknown"}

        @app.get("/http/{status}")
        def http_exception_endpoint(status: int) -> dict[str, Any]:
            raise HTTPException(status_code=status, detail="HTTP error")

        @app.get("/unhandled")
        def unhandled_endpoint() -> dict[str, Any]:
            raise RuntimeError("Unhandled")

        return app

    @pytest.fixture
    def comprehensive_client(
        self, comprehensive_error_app: FastAPI
    ) -> Generator[TestClient, None, None]:
        """Create a TestClient for the comprehensive error app."""
        with TestClient(comprehensive_error_app, raise_server_exceptions=False) as client:
            yield client

    def test_all_errors_have_consistent_schema(
        self, comprehensive_client: TestClient
    ) -> None:
        """All error responses should have identical schema structure."""
        # Collect responses from different error types
        responses = [
            comprehensive_client.post("/validation", json={}),
            comprehensive_client.get("/custom/not_found"),
            comprehensive_client.get("/custom/validation"),
            comprehensive_client.get("/custom/unauthorized"),
            comprehensive_client.get("/custom/forbidden"),
            comprehensive_client.get("/custom/database"),
            comprehensive_client.get("/custom/business"),
            comprehensive_client.get("/http/400"),
            comprehensive_client.get("/http/404"),
            comprehensive_client.get("/http/500"),
            comprehensive_client.get("/unhandled"),
        ]

        for response in responses:
            data = response.json()
            assert set(data.keys()) == ERROR_RESPONSE_FIELDS, (
                f"Response with status {response.status_code} has incorrect schema"
            )

    def test_all_errors_have_required_fields_with_values(
        self, comprehensive_client: TestClient
    ) -> None:
        """All error responses should have non-null required fields."""
        responses = [
            comprehensive_client.post("/validation", json={}),
            comprehensive_client.get("/custom/not_found"),
            comprehensive_client.get("/http/400"),
            comprehensive_client.get("/unhandled"),
        ]

        for response in responses:
            data = response.json()

            # Required fields should have values
            assert isinstance(data["status_code"], int)
            assert data["status_code"] > 0

            assert isinstance(data["error_type"], str)
            assert len(data["error_type"]) > 0

            assert isinstance(data["message"], str)
            assert len(data["message"]) > 0

    def test_status_codes_are_consistent(
        self, comprehensive_client: TestClient
    ) -> None:
        """HTTP status and body status_code should always match."""
        test_cases = [
            ("/custom/not_found", 404),
            ("/custom/validation", 400),
            ("/custom/unauthorized", 401),
            ("/custom/forbidden", 403),
            ("/custom/database", 503),
            ("/custom/business", 422),
            ("/http/400", 400),
            ("/http/404", 404),
            ("/http/500", 500),
            ("/unhandled", 500),
        ]

        for endpoint, expected_status in test_cases:
            response = comprehensive_client.get(endpoint)

            assert response.status_code == expected_status, (
                f"Expected {expected_status} for {endpoint}, got {response.status_code}"
            )
            assert response.json()["status_code"] == expected_status, (
                f"Body status_code mismatch for {endpoint}"
            )
