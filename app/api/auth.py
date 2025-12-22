"""
Webhook Authentication Module

This module provides authentication functions for VAPI webhook endpoints.
It implements defense-in-depth security with HMAC-SHA256 signature validation
and API key authentication.
"""

import hashlib
import hmac
import os

from fastapi import HTTPException, Request


async def verify_webhook_signature(request: Request) -> bytes:
    """Verify HMAC-SHA256 signature from VAPI webhook request.

    This function validates that the incoming webhook request has a valid
    signature proving it originated from VAPI. The signature is computed
    using HMAC-SHA256 with the VAPI_SERVER_SECRET.

    CRITICAL: This function must read the raw body BEFORE any JSON parsing
    to ensure signature verification works correctly.

    Args:
        request: The incoming FastAPI request object.

    Returns:
        bytes: The raw request body payload for subsequent parsing.

    Raises:
        HTTPException: 401 Unauthorized if signature is missing, invalid,
            or if VAPI_SERVER_SECRET is not configured.
    """
    # Get the signature from header
    signature = request.headers.get("x-vapi-signature", "")
    if not signature:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Get the server secret - fail closed if not configured
    server_secret = os.getenv("VAPI_SERVER_SECRET", "")
    if not server_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Read raw body BEFORE any JSON parsing
    payload = await request.body()

    # Compute expected signature
    expected_signature = hmac.new(
        server_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    # Timing-safe comparison to prevent timing attacks
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return payload


def verify_api_key(request: Request) -> None:
    """Validate API key from X-API-Key header.

    This function provides an additional security layer by validating
    an API key header. This enables key rotation without requiring
    changes in the VAPI dashboard.

    Args:
        request: The incoming FastAPI request object.

    Raises:
        HTTPException: 401 Unauthorized if API key is missing, invalid,
            or if WEBHOOK_API_KEY is not configured.
    """
    # Get the API key from header
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Get the expected API key - fail closed if not configured
    expected_api_key = os.getenv("WEBHOOK_API_KEY", "")
    if not expected_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Timing-safe comparison to prevent timing attacks
    if not hmac.compare_digest(api_key, expected_api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def verify_webhook_auth(request: Request) -> bytes:
    """Combined authentication dependency for VAPI webhooks.

    This dependency implements defense-in-depth security by running both
    signature verification and API key validation in order. Both checks
    must pass for the request to proceed.

    Order of validation:
    1. HMAC-SHA256 signature verification (proves request came from VAPI)
    2. API key validation (enables key rotation without VAPI changes)

    Usage:
        @router.post("/", dependencies=[Depends(verify_webhook_auth)])
        async def handle_event(...):
            ...

        Or to receive the validated payload:
        @router.post("/")
        async def handle_event(payload: bytes = Depends(verify_webhook_auth)):
            data = json.loads(payload)
            ...

    Args:
        request: The incoming FastAPI request object.

    Returns:
        bytes: The raw request body payload for subsequent parsing.

    Raises:
        HTTPException: 401 Unauthorized if either authentication check fails.
    """
    # Step 1: Verify webhook signature (reads raw body, returns payload)
    payload = await verify_webhook_signature(request)

    # Step 2: Verify API key
    verify_api_key(request)

    # Both checks passed - return payload for subsequent parsing
    return payload
