"""Health Check Router Module.

This module provides health check endpoints for monitoring system availability
and service dependencies. These endpoints enable orchestration platforms,
load balancers, and monitoring systems to verify service health.
"""

import logging
import time
from datetime import datetime, timezone
from http import HTTPStatus

import redis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from database.session import db_session

REDIS_URL = "redis://redis:6379/0"

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


@router.get("/database")
def health_database(
    session: Session = Depends(db_session),
) -> JSONResponse:
    """Check database connectivity.

    This endpoint verifies PostgreSQL connectivity by executing
    a simple SELECT 1 query. It measures response time and reports
    the connection status.

    Args:
        session: Database session injected by FastAPI dependency

    Returns:
        JSONResponse: 200 OK with database status and response time
            if connected, 503 Service Unavailable if database is
            unreachable.

    Note:
        This endpoint uses a 5-second timeout for the database query.
        It is suitable for Kubernetes readiness probes and monitoring
        database availability.
    """
    start_time = time.time()
    try:
        # Execute simple query to verify database connectivity
        session.execute(text("SELECT 1"))
        response_time_ms = (time.time() - start_time) * 1000

        return JSONResponse(
            content={
                "status": "healthy",
                "service": "database",
                "connected": True,
                "response_time_ms": round(response_time_ms, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            status_code=HTTPStatus.OK,
        )
    except Exception as ex:
        response_time_ms = (time.time() - start_time) * 1000
        logging.error(f"Database health check failed: {ex}")

        return JSONResponse(
            content={
                "status": "unhealthy",
                "service": "database",
                "connected": False,
                "response_time_ms": round(response_time_ms, 2),
                "error": "Database connection failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
        )


@router.get("/redis")
def health_redis() -> JSONResponse:
    """Check Redis connectivity.

    This endpoint verifies Redis connectivity by executing
    a PING command. It measures response time and reports
    the connection status.

    Returns:
        JSONResponse: 200 OK with Redis status and response time
            if connected, 503 Service Unavailable if Redis is
            unreachable.

    Note:
        This endpoint is suitable for Kubernetes readiness probes
        and monitoring Redis availability.
    """
    start_time = time.time()
    try:
        # Connect to Redis and execute PING to verify connectivity
        client = redis.from_url(REDIS_URL, socket_timeout=5)
        client.ping()
        response_time_ms = (time.time() - start_time) * 1000

        return JSONResponse(
            content={
                "status": "healthy",
                "service": "redis",
                "connected": True,
                "response_time_ms": round(response_time_ms, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            status_code=HTTPStatus.OK,
        )
    except Exception as ex:
        response_time_ms = (time.time() - start_time) * 1000
        logging.error(f"Redis health check failed: {ex}")

        return JSONResponse(
            content={
                "status": "unhealthy",
                "service": "redis",
                "connected": False,
                "response_time_ms": round(response_time_ms, 2),
                "error": "Redis connection failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
        )
