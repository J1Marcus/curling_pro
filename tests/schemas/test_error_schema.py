"""
Unit tests for ErrorResponse Pydantic schema.

This module tests the ErrorResponse schema for:
    - Required field validation (status_code, error_type, message)
    - Optional field handling (detail, request_id)
    - JSON serialization and deserialization
    - Field type validation
"""

import json

import pytest
from pydantic import ValidationError

from app.schemas.error_schema import ErrorResponse


class TestErrorResponseRequiredFields:
    """Tests for ErrorResponse required field validation."""

    def test_create_with_all_required_fields(self) -> None:
        """ErrorResponse should be created successfully with all required fields."""
        error = ErrorResponse(
            status_code=404,
            error_type="not_found",
            message="Resource not found",
        )

        assert error.status_code == 404
        assert error.error_type == "not_found"
        assert error.message == "Resource not found"

    def test_missing_status_code_raises_error(self) -> None:
        """Missing status_code should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(  # type: ignore[call-arg]
                error_type="not_found",
                message="Resource not found",
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("status_code",)
        assert errors[0]["type"] == "missing"

    def test_missing_error_type_raises_error(self) -> None:
        """Missing error_type should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(  # type: ignore[call-arg]
                status_code=404,
                message="Resource not found",
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("error_type",)
        assert errors[0]["type"] == "missing"

    def test_missing_message_raises_error(self) -> None:
        """Missing message should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(  # type: ignore[call-arg]
                status_code=404,
                error_type="not_found",
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("message",)
        assert errors[0]["type"] == "missing"

    def test_missing_all_required_fields_raises_error(self) -> None:
        """Missing all required fields should raise ValidationError with multiple errors."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse()  # type: ignore[call-arg]

        errors = exc_info.value.errors()
        assert len(errors) == 3

        error_locs = {error["loc"][0] for error in errors}
        assert error_locs == {"status_code", "error_type", "message"}


class TestErrorResponseOptionalFields:
    """Tests for ErrorResponse optional field handling."""

    def test_optional_fields_default_to_none(self) -> None:
        """Optional fields should default to None when not provided."""
        error = ErrorResponse(
            status_code=500,
            error_type="internal_server_error",
            message="An unexpected error occurred",
        )

        assert error.detail is None
        assert error.request_id is None

    def test_create_with_detail_field(self) -> None:
        """ErrorResponse should accept and store detail field."""
        error = ErrorResponse(
            status_code=422,
            error_type="validation_error",
            message="Validation failed",
            detail="Field 'email' is required",
        )

        assert error.detail == "Field 'email' is required"

    def test_create_with_request_id_field(self) -> None:
        """ErrorResponse should accept and store request_id field."""
        error = ErrorResponse(
            status_code=503,
            error_type="service_unavailable",
            message="Database connection failed",
            request_id="req-123-abc-456",
        )

        assert error.request_id == "req-123-abc-456"

    def test_create_with_all_fields(self) -> None:
        """ErrorResponse should accept all fields including optional ones."""
        error = ErrorResponse(
            status_code=400,
            error_type="bad_request",
            message="Invalid request",
            detail="The 'age' field must be a positive integer",
            request_id="req-789-xyz-012",
        )

        assert error.status_code == 400
        assert error.error_type == "bad_request"
        assert error.message == "Invalid request"
        assert error.detail == "The 'age' field must be a positive integer"
        assert error.request_id == "req-789-xyz-012"

    def test_optional_fields_can_be_explicitly_none(self) -> None:
        """Optional fields should accept explicit None values."""
        error = ErrorResponse(
            status_code=401,
            error_type="unauthorized",
            message="Authentication required",
            detail=None,
            request_id=None,
        )

        assert error.detail is None
        assert error.request_id is None


class TestErrorResponseJsonSerialization:
    """Tests for ErrorResponse JSON serialization and deserialization."""

    def test_model_dump_returns_dict(self) -> None:
        """model_dump() should return a dictionary with all fields."""
        error = ErrorResponse(
            status_code=404,
            error_type="not_found",
            message="User not found",
            detail="No user with ID 123",
            request_id="req-001",
        )

        data = error.model_dump()

        assert isinstance(data, dict)
        assert data == {
            "status_code": 404,
            "error_type": "not_found",
            "message": "User not found",
            "detail": "No user with ID 123",
            "request_id": "req-001",
        }

    def test_model_dump_excludes_none_when_configured(self) -> None:
        """model_dump(exclude_none=True) should omit None values."""
        error = ErrorResponse(
            status_code=500,
            error_type="internal_server_error",
            message="An error occurred",
        )

        data = error.model_dump(exclude_none=True)

        assert "status_code" in data
        assert "error_type" in data
        assert "message" in data
        assert "detail" not in data
        assert "request_id" not in data

    def test_model_dump_json_returns_valid_json(self) -> None:
        """model_dump_json() should return valid JSON string."""
        error = ErrorResponse(
            status_code=403,
            error_type="forbidden",
            message="Access denied",
        )

        json_str = error.model_dump_json()

        assert isinstance(json_str, str)

        # Verify it's valid JSON by parsing it
        parsed = json.loads(json_str)
        assert parsed["status_code"] == 403
        assert parsed["error_type"] == "forbidden"
        assert parsed["message"] == "Access denied"

    def test_model_validate_from_dict(self) -> None:
        """model_validate() should create ErrorResponse from dictionary."""
        data = {
            "status_code": 422,
            "error_type": "validation_error",
            "message": "Invalid input",
            "detail": "Email format is invalid",
            "request_id": "req-456",
        }

        error = ErrorResponse.model_validate(data)

        assert error.status_code == 422
        assert error.error_type == "validation_error"
        assert error.message == "Invalid input"
        assert error.detail == "Email format is invalid"
        assert error.request_id == "req-456"

    def test_model_validate_json_from_string(self) -> None:
        """model_validate_json() should create ErrorResponse from JSON string."""
        json_str = '{"status_code": 400, "error_type": "bad_request", "message": "Bad request"}'

        error = ErrorResponse.model_validate_json(json_str)

        assert error.status_code == 400
        assert error.error_type == "bad_request"
        assert error.message == "Bad request"

    def test_roundtrip_serialization(self) -> None:
        """Serialization and deserialization should preserve all data."""
        original = ErrorResponse(
            status_code=503,
            error_type="service_unavailable",
            message="Service temporarily unavailable",
            detail="Database connection pool exhausted",
            request_id="req-roundtrip-test",
        )

        # Serialize to JSON and back
        json_str = original.model_dump_json()
        restored = ErrorResponse.model_validate_json(json_str)

        assert restored.status_code == original.status_code
        assert restored.error_type == original.error_type
        assert restored.message == original.message
        assert restored.detail == original.detail
        assert restored.request_id == original.request_id


class TestErrorResponseFieldTypes:
    """Tests for ErrorResponse field type validation."""

    def test_status_code_must_be_integer(self) -> None:
        """status_code field should only accept integers."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(
                status_code="404",  # type: ignore[arg-type]
                error_type="not_found",
                message="Not found",
            )

        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("status_code",)
        assert "int" in errors[0]["type"]

    def test_status_code_accepts_valid_http_codes(self) -> None:
        """status_code should accept standard HTTP status codes."""
        # Test common HTTP status codes
        valid_codes = [200, 201, 204, 301, 302, 400, 401, 403, 404, 422, 500, 502, 503]

        for code in valid_codes:
            error = ErrorResponse(
                status_code=code,
                error_type="test_error",
                message="Test message",
            )
            assert error.status_code == code

    def test_error_type_must_be_string(self) -> None:
        """error_type field should only accept strings."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(
                status_code=500,
                error_type=500,  # type: ignore[arg-type]
                message="Error",
            )

        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("error_type",)
        assert "str" in errors[0]["type"]

    def test_message_must_be_string(self) -> None:
        """message field should only accept strings."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(
                status_code=500,
                error_type="internal_server_error",
                message=["Error occurred"],  # type: ignore[arg-type]
            )

        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("message",)
        assert "str" in errors[0]["type"]

    def test_detail_must_be_string_or_none(self) -> None:
        """detail field should only accept strings or None."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(
                status_code=400,
                error_type="bad_request",
                message="Bad request",
                detail={"field": "error"},  # type: ignore[arg-type]
            )

        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("detail",)

    def test_request_id_must_be_string_or_none(self) -> None:
        """request_id field should only accept strings or None."""
        with pytest.raises(ValidationError) as exc_info:
            ErrorResponse(
                status_code=500,
                error_type="internal_server_error",
                message="Error",
                request_id=12345,  # type: ignore[arg-type]
            )

        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("request_id",)


class TestErrorResponseCommonScenarios:
    """Tests for common error response scenarios."""

    def test_validation_error_response(self) -> None:
        """Test creating a typical validation error response."""
        error = ErrorResponse(
            status_code=422,
            error_type="validation_error",
            message="Request validation failed",
            detail="body.email: field required; body.password: must be at least 8 characters",
        )

        assert error.status_code == 422
        assert "validation" in error.error_type
        assert error.detail is not None

    def test_not_found_error_response(self) -> None:
        """Test creating a typical not found error response."""
        error = ErrorResponse(
            status_code=404,
            error_type="not_found",
            message="The requested resource was not found",
            request_id="req-404-test",
        )

        assert error.status_code == 404
        assert error.error_type == "not_found"

    def test_unauthorized_error_response(self) -> None:
        """Test creating a typical unauthorized error response."""
        error = ErrorResponse(
            status_code=401,
            error_type="unauthorized",
            message="Authentication required",
        )

        assert error.status_code == 401
        assert error.error_type == "unauthorized"

    def test_internal_server_error_response(self) -> None:
        """Test creating a typical internal server error response."""
        error = ErrorResponse(
            status_code=500,
            error_type="internal_server_error",
            message="An unexpected error occurred",
            request_id="req-500-internal",
        )

        assert error.status_code == 500
        assert error.error_type == "internal_server_error"
        # Note: detail should NOT contain stack traces in production responses

    def test_database_error_response(self) -> None:
        """Test creating a typical database error response."""
        error = ErrorResponse(
            status_code=503,
            error_type="service_unavailable",
            message="Service temporarily unavailable",
            detail="Please try again later",
        )

        assert error.status_code == 503
        assert error.error_type == "service_unavailable"
