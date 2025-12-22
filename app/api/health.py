"""Health Check Router Module.

This module provides health check endpoints for monitoring system availability
and service dependencies. These endpoints enable orchestration platforms,
load balancers, and monitoring systems to verify service health.
"""

from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import APIRouter
from starlette.responses import JSONResponse

router = APIRouter()


@router.get("/api")
def health_api() -> JSONResponse:
    """Check API liveness.

    This is a minimal endpoint to verify the API is responding.
    It performs no external dependency checks and should respond
    in under 100ms.

    Returns:
        JSONResponse: 200 OK with status, timestamp, and service name.

    Note:
        This endpoint is suitable for Kubernetes liveness probes
        and basic load balancer health checks.
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "api",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        status_code=HTTPStatus.OK,
    )
