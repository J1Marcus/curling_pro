"""
Webhook Authentication Module

This module provides authentication functions for VAPI webhook endpoints.
It implements defense-in-depth security with HMAC-SHA256 signature validation
and API key authentication.
"""

import hashlib
import hmac
import os

from fastapi import Depends, HTTPException, Request


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
