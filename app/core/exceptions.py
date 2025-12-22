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
