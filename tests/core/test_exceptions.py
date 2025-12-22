"""
Unit tests for custom exception classes.

This module tests all custom exception classes in app/core/exceptions.py for:
    - Message handling (default and custom messages)
    - status_code attributes (where applicable)
    - Logging behavior (correct log levels)
    - Exception inheritance and behavior
"""

import logging

import pytest

from app.core.exceptions import (
    BusinessLogicError,
    DatabaseError,
    ForbiddenError,
    LangfuseAuthenticationError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)


class TestLangfuseAuthenticationError:
    """Tests for LangfuseAuthenticationError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = LangfuseAuthenticationError()

        assert str(error) == "Failed to authenticate with Langfuse."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "Custom Langfuse authentication failure message"
        error = LangfuseAuthenticationError(message=custom_msg)

        assert str(error) == custom_msg

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(LangfuseAuthenticationError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(LangfuseAuthenticationError) as exc_info:
            raise LangfuseAuthenticationError("Test error")

        assert str(exc_info.value) == "Test error"

    def test_logs_error_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at ERROR level when created."""
        caplog.set_level(logging.ERROR)

        LangfuseAuthenticationError("Auth failed with Langfuse")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.ERROR
        assert "Auth failed with Langfuse" in caplog.records[0].message

    def test_logs_default_message(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log the default message when no custom message provided."""
        caplog.set_level(logging.ERROR)

        LangfuseAuthenticationError()

        assert "Failed to authenticate with Langfuse" in caplog.text


class TestNotFoundError:
    """Tests for NotFoundError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = NotFoundError()

        assert str(error) == "The requested resource was not found."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "User with ID 123 not found"
        error = NotFoundError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 404."""
        assert NotFoundError.status_code == 404

        error = NotFoundError()
        assert error.status_code == 404

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(NotFoundError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(NotFoundError) as exc_info:
            raise NotFoundError("Resource not found")

        assert str(exc_info.value) == "Resource not found"
        assert exc_info.value.status_code == 404

    def test_logs_warning_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at WARNING level when created (4xx error)."""
        caplog.set_level(logging.WARNING)

        NotFoundError("Item not found in database")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert "Item not found in database" in caplog.records[0].message


class TestValidationError:
    """Tests for ValidationError exception (business logic validation)."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = ValidationError()

        assert str(error) == "Validation failed."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "Email format is invalid"
        error = ValidationError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 400."""
        assert ValidationError.status_code == 400

        error = ValidationError()
        assert error.status_code == 400

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(ValidationError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(ValidationError) as exc_info:
            raise ValidationError("Invalid data format")

        assert str(exc_info.value) == "Invalid data format"
        assert exc_info.value.status_code == 400

    def test_logs_warning_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at WARNING level when created (4xx error)."""
        caplog.set_level(logging.WARNING)

        ValidationError("Username must be at least 3 characters")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert "Username must be at least 3 characters" in caplog.records[0].message

    def test_distinct_from_pydantic_validation_error(self) -> None:
        """This ValidationError should be distinct from Pydantic's ValidationError."""
        from pydantic import ValidationError as PydanticValidationError

        # They should be different classes
        assert ValidationError is not PydanticValidationError
        assert not issubclass(ValidationError, PydanticValidationError)


class TestUnauthorizedError:
    """Tests for UnauthorizedError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = UnauthorizedError()

        assert str(error) == "Authentication required."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "Invalid API key provided"
        error = UnauthorizedError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 401."""
        assert UnauthorizedError.status_code == 401

        error = UnauthorizedError()
        assert error.status_code == 401

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(UnauthorizedError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(UnauthorizedError) as exc_info:
            raise UnauthorizedError("Token expired")

        assert str(exc_info.value) == "Token expired"
        assert exc_info.value.status_code == 401

    def test_logs_warning_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at WARNING level when created (4xx error)."""
        caplog.set_level(logging.WARNING)

        UnauthorizedError("Bearer token missing from request")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert "Bearer token missing from request" in caplog.records[0].message


class TestForbiddenError:
    """Tests for ForbiddenError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = ForbiddenError()

        assert str(error) == "Permission denied."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "User lacks admin privileges"
        error = ForbiddenError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 403."""
        assert ForbiddenError.status_code == 403

        error = ForbiddenError()
        assert error.status_code == 403

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(ForbiddenError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(ForbiddenError) as exc_info:
            raise ForbiddenError("Access to resource denied")

        assert str(exc_info.value) == "Access to resource denied"
        assert exc_info.value.status_code == 403

    def test_logs_warning_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at WARNING level when created (4xx error)."""
        caplog.set_level(logging.WARNING)

        ForbiddenError("User cannot access admin panel")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert "User cannot access admin panel" in caplog.records[0].message


class TestDatabaseError:
    """Tests for DatabaseError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = DatabaseError()

        assert str(error) == "Database operation failed."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "Connection to PostgreSQL timed out"
        error = DatabaseError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 503."""
        assert DatabaseError.status_code == 503

        error = DatabaseError()
        assert error.status_code == 503

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(DatabaseError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(DatabaseError) as exc_info:
            raise DatabaseError("Query execution failed")

        assert str(exc_info.value) == "Query execution failed"
        assert exc_info.value.status_code == 503

    def test_logs_error_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at ERROR level when created (5xx error)."""
        caplog.set_level(logging.ERROR)

        DatabaseError("Failed to connect to database server")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.ERROR
        assert "Failed to connect to database server" in caplog.records[0].message


class TestBusinessLogicError:
    """Tests for BusinessLogicError exception."""

    def test_default_message(self) -> None:
        """Exception should have a sensible default message."""
        error = BusinessLogicError()

        assert str(error) == "Business rule violation."

    def test_custom_message(self) -> None:
        """Exception should accept and use custom messages."""
        custom_msg = "Cannot transition order from 'completed' to 'pending'"
        error = BusinessLogicError(message=custom_msg)

        assert str(error) == custom_msg

    def test_status_code_attribute(self) -> None:
        """Exception should have status_code attribute set to 422."""
        assert BusinessLogicError.status_code == 422

        error = BusinessLogicError()
        assert error.status_code == 422

    def test_is_exception_subclass(self) -> None:
        """Exception should be a subclass of Exception."""
        assert issubclass(BusinessLogicError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        """Exception should be raisable and catchable."""
        with pytest.raises(BusinessLogicError) as exc_info:
            raise BusinessLogicError("Insufficient inventory for order")

        assert str(exc_info.value) == "Insufficient inventory for order"
        assert exc_info.value.status_code == 422

    def test_logs_warning_on_creation(self, caplog: pytest.LogCaptureFixture) -> None:
        """Exception should log at WARNING level when created (4xx error)."""
        caplog.set_level(logging.WARNING)

        BusinessLogicError("Duplicate booking for same time slot")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.WARNING
        assert "Duplicate booking for same time slot" in caplog.records[0].message


class TestExceptionStatusCodeConsistency:
    """Tests verifying status code consistency across all exceptions."""

    def test_all_custom_exceptions_have_status_codes(self) -> None:
        """All custom exceptions (except LangfuseAuthenticationError) should have status_code."""
        exceptions_with_codes = [
            (NotFoundError, 404),
            (ValidationError, 400),
            (UnauthorizedError, 401),
            (ForbiddenError, 403),
            (DatabaseError, 503),
            (BusinessLogicError, 422),
        ]

        for exc_class, expected_code in exceptions_with_codes:
            assert hasattr(exc_class, "status_code"), (
                f"{exc_class.__name__} should have status_code attribute"
            )
            assert exc_class.status_code == expected_code, (
                f"{exc_class.__name__} should have status_code={expected_code}"
            )

    def test_4xx_errors_log_warning(self, caplog: pytest.LogCaptureFixture) -> None:
        """4xx error exceptions should log at WARNING level."""
        caplog.set_level(logging.WARNING)

        # Create each 4xx exception
        NotFoundError("test")
        ValidationError("test")
        UnauthorizedError("test")
        ForbiddenError("test")
        BusinessLogicError("test")

        # All should be warnings
        assert all(r.levelno == logging.WARNING for r in caplog.records)
        assert len(caplog.records) == 5

    def test_5xx_errors_log_error(self, caplog: pytest.LogCaptureFixture) -> None:
        """5xx error exceptions should log at ERROR level."""
        caplog.set_level(logging.ERROR)

        DatabaseError("test")

        assert len(caplog.records) == 1
        assert caplog.records[0].levelno == logging.ERROR


class TestExceptionMessagePreservation:
    """Tests verifying exception messages are preserved correctly."""

    def test_messages_with_special_characters(self) -> None:
        """Exception messages should preserve special characters."""
        special_msg = "Error: 'data' contains <invalid> \"characters\" & symbols!"

        for exc_class in [
            NotFoundError,
            ValidationError,
            UnauthorizedError,
            ForbiddenError,
            DatabaseError,
            BusinessLogicError,
        ]:
            error = exc_class(message=special_msg)
            assert str(error) == special_msg

    def test_messages_with_unicode(self) -> None:
        """Exception messages should preserve unicode characters."""
        unicode_msg = "Error: 数据无效 - データが無効です - Données invalides"

        for exc_class in [
            NotFoundError,
            ValidationError,
            UnauthorizedError,
            ForbiddenError,
            DatabaseError,
            BusinessLogicError,
        ]:
            error = exc_class(message=unicode_msg)
            assert str(error) == unicode_msg

    def test_empty_message(self) -> None:
        """Exception should accept empty string as message."""
        error = NotFoundError(message="")
        assert str(error) == ""

    def test_whitespace_message(self) -> None:
        """Exception should preserve whitespace in messages."""
        whitespace_msg = "  Error with leading and trailing spaces  "
        error = ValidationError(message=whitespace_msg)
        assert str(error) == whitespace_msg

    def test_multiline_message(self) -> None:
        """Exception should preserve newlines in messages."""
        multiline_msg = "Error occurred:\n- Detail 1\n- Detail 2"
        error = BusinessLogicError(message=multiline_msg)
        assert str(error) == multiline_msg
