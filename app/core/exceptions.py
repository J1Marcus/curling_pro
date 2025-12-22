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
