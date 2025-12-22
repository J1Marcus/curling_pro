"""Health Check Router Module.

This module provides health check endpoints for monitoring system availability
and service dependencies. These endpoints enable orchestration platforms,
load balancers, and monitoring systems to verify service health.
"""

import logging
import os
import time
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

import redis
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from database.session import db_session

load_dotenv()

REDIS_URL = "redis://redis:6379/0"
EXTERNAL_SERVICE_TIMEOUT = 10  # seconds

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


def _check_external_service_config(
    service_name: str,
    required_env_vars: list[str],
) -> dict[str, Any]:
    """Check if an external service is configured via environment variables.

    Args:
        service_name: Name of the external service
        required_env_vars: List of required environment variable names

    Returns:
        dict: Service status with configured flag and details
    """
    configured_vars = {var: bool(os.getenv(var)) for var in required_env_vars}
    all_configured = all(configured_vars.values())

    return {
        "service": service_name,
        "configured": all_configured,
        "status": "configured" if all_configured else "not_configured",
    }


def _check_url_connectivity(
    service_name: str,
    url: str,
    timeout: int = EXTERNAL_SERVICE_TIMEOUT,
) -> dict[str, Any]:
    """Check connectivity to an external service URL.

    Args:
        service_name: Name of the external service
        url: URL to check connectivity
        timeout: Request timeout in seconds

    Returns:
        dict: Service status with reachable flag and response time
    """
    start_time = time.time()
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        response_time_ms = (time.time() - start_time) * 1000
        reachable = response.status_code < 500

        return {
            "service": service_name,
            "configured": True,
            "reachable": reachable,
            "status": "healthy" if reachable else "unhealthy",
            "response_time_ms": round(response_time_ms, 2),
        }
    except requests.exceptions.Timeout:
        response_time_ms = (time.time() - start_time) * 1000
        return {
            "service": service_name,
            "configured": True,
            "reachable": False,
            "status": "timeout",
            "response_time_ms": round(response_time_ms, 2),
            "error": "Connection timed out",
        }
    except requests.exceptions.RequestException as ex:
        response_time_ms = (time.time() - start_time) * 1000
        logging.error(f"External service check failed for {service_name}: {ex}")
        return {
            "service": service_name,
            "configured": True,
            "reachable": False,
            "status": "unreachable",
            "response_time_ms": round(response_time_ms, 2),
            "error": "Connection failed",
        }


@router.get("/external")
def health_external() -> JSONResponse:
    """Check external services availability.

    This endpoint checks the configuration and availability of external
    services including LLM providers (OpenAI, Azure OpenAI, Anthropic)
    and observability platforms (Langfuse). This is a best-effort check
    that verifies configuration and, where possible, connectivity.

    Returns:
        JSONResponse: 200 OK with individual service statuses. The overall
            status will be "healthy" if all configured services are
            reachable, "degraded" if some services are unavailable, or
            "healthy" if no external services are configured.

    Note:
        For API key-based services (OpenAI, Anthropic), this endpoint only
        verifies that the API keys are configured, not that they are valid.
        For URL-based services (Langfuse), it performs a connectivity check.
        This endpoint uses a 10-second timeout for connectivity checks.
    """
    start_time = time.time()
    services: list[dict[str, Any]] = []

    # Check OpenAI configuration
    openai_status = _check_external_service_config(
        service_name="openai",
        required_env_vars=["OPENAI_API_KEY"],
    )
    services.append(openai_status)

    # Check Azure OpenAI configuration
    azure_openai_status = _check_external_service_config(
        service_name="azure_openai",
        required_env_vars=["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY"],
    )
    services.append(azure_openai_status)

    # Check Anthropic configuration
    anthropic_status = _check_external_service_config(
        service_name="anthropic",
        required_env_vars=["ANTHROPIC_API_KEY"],
    )
    services.append(anthropic_status)

    # Check Langfuse configuration and connectivity
    langfuse_url = os.getenv("LANGFUSE_BASE_URL")
    if langfuse_url:
        langfuse_status = _check_url_connectivity(
            service_name="langfuse",
            url=langfuse_url,
        )
    else:
        langfuse_status = {
            "service": "langfuse",
            "configured": False,
            "status": "not_configured",
        }
    services.append(langfuse_status)

    response_time_ms = (time.time() - start_time) * 1000

    # Determine overall status
    configured_services = [s for s in services if s.get("configured")]
    if not configured_services:
        overall_status = "healthy"  # No external services configured
    else:
        # Check if any configured service with connectivity check failed
        unhealthy_services = [
            s for s in configured_services
            if s.get("status") in ("unhealthy", "timeout", "unreachable")
        ]
        if unhealthy_services:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

    return JSONResponse(
        content={
            "status": overall_status,
            "service": "external",
            "services": services,
            "response_time_ms": round(response_time_ms, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        status_code=HTTPStatus.OK,
    )
