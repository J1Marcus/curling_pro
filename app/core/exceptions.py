import logging


class LangfuseAuthenticationError(Exception):
    """Raised when Langfuse authentication fails."""

    def __init__(self, message: str = "Failed to authenticate with Langfuse."):
        logging.error(message)
        super().__init__(message)


class NotFoundError(Exception):
    """Raised when a requested resource is not found."""

    status_code: int = 404

    def __init__(self, message: str = "The requested resource was not found."):
        logging.warning(message)
        super().__init__(message)


class ValidationError(Exception):
    """Raised when business logic validation fails.

    This is distinct from Pydantic's ValidationError which handles request
    schema validation. Use this for custom validation rules in business logic.
    """

    status_code: int = 400

    def __init__(self, message: str = "Validation failed."):
        logging.warning(message)
        super().__init__(message)


class UnauthorizedError(Exception):
    """Raised when authentication or authorization fails.

    Use this for scenarios where the user is not authenticated or lacks
    valid credentials to access the requested resource.
    """

    status_code: int = 401

    def __init__(self, message: str = "Authentication required."):
        logging.warning(message)
        super().__init__(message)


class ForbiddenError(Exception):
    """Raised when the user lacks permission to access the resource.

    Use this for scenarios where the user is authenticated but does not
    have sufficient permissions to perform the requested action.
    """

    status_code: int = 403

    def __init__(self, message: str = "Permission denied."):
        logging.warning(message)
        super().__init__(message)


class DatabaseError(Exception):
    """Raised when a database operation fails.

    Use this for database connection failures, query errors, or other
    database-related issues. Returns 503 Service Unavailable to indicate
    the service is temporarily unable to handle the request.
    """

    status_code: int = 503

    def __init__(self, message: str = "Database operation failed."):
        logging.error(message)
        super().__init__(message)
