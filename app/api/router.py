"""API Router Module.

This module sets up the API router and includes all defined endpoints.
It uses FastAPI's APIRouter to group related endpoints and provide a prefix.
"""

from fastapi import APIRouter

from api import events
from api import health
from api import openai
from app.api import test_errors

router = APIRouter()

router.include_router(events.router, prefix="/events", tags=["events"])
router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(openai.router, prefix="/v1", tags=["openai"])
router.include_router(test_errors.router, prefix="/test-errors", tags=["test-errors"])
