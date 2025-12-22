from fastapi import FastAPI

from api.router import router as process_router
from app.middleware import register_exception_handlers

app = FastAPI()

# Register exception handlers for standardized error responses
register_exception_handlers(app)

app.include_router(process_router)
