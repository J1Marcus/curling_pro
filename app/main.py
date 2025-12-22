from fastapi import FastAPI

from api.router import router as process_router
from app.middleware import register_exception_handlers
from app.schemas.error_schema import ErrorResponse

# Define common error responses for all endpoints
# This ensures ErrorResponse schema appears in OpenAPI documentation
COMMON_ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Bad Request - Validation error"},
    401: {"model": ErrorResponse, "description": "Unauthorized - Authentication required"},
    403: {"model": ErrorResponse, "description": "Forbidden - Permission denied"},
    404: {"model": ErrorResponse, "description": "Not Found - Resource not found"},
    422: {"model": ErrorResponse, "description": "Unprocessable Entity - Validation failed"},
    500: {"model": ErrorResponse, "description": "Internal Server Error"},
    503: {"model": ErrorResponse, "description": "Service Unavailable - Database error"},
}

app = FastAPI(
    title="Everbound API",
    description="FastAPI backend with standardized error handling",
    responses=COMMON_ERROR_RESPONSES,
)

# Register exception handlers for standardized error responses
register_exception_handlers(app)

app.include_router(process_router)
