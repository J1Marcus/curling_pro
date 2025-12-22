"""
Unit Tests for Webhook Authentication

This module contains unit tests for the signature verification and API key
authentication functions in app/api/auth.py.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

# Import test fixtures and helpers
from conftest import TEST_VAPI_SERVER_SECRET, generate_signature


class TestVerifyWebhookSignature:
    """Test suite for verify_webhook_signature function."""

    @pytest.fixture
    def mock_request(self, sample_payload: bytes) -> MagicMock:
        """Create a mock FastAPI Request object.

        Args:
            sample_payload: The payload bytes to return from body().

        Returns:
            MagicMock: A mock request object with headers and body.
        """
        request = MagicMock()
        request.body = AsyncMock(return_value=sample_payload)
        return request

    @pytest.mark.asyncio
    async def test_valid_signature_accepted(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that a valid HMAC-SHA256 signature is accepted.

        Verifies that when a request contains a correctly computed
        signature, the verification succeeds and returns the payload.
        """
        from app.api.auth import verify_webhook_signature

        # Generate valid signature
        signature = generate_signature(sample_payload, TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {"x-vapi-signature": signature}

        # Verify signature passes and returns payload
        result = await verify_webhook_signature(mock_request)
        assert result == sample_payload

    @pytest.mark.asyncio
    async def test_invalid_signature_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that an invalid signature is rejected with 401.

        Verifies that when a request contains an incorrect signature,
        the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_webhook_signature

        # Set invalid signature
        mock_request.headers = {"x-vapi-signature": "invalid-signature-12345"}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_missing_signature_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that a missing signature header is rejected with 401.

        Verifies that when a request does not include the x-vapi-signature
        header, the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_webhook_signature

        # No signature header
        mock_request.headers = {}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_empty_signature_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that an empty signature header is rejected with 401.

        Verifies that when a request includes an empty x-vapi-signature
        header value, the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_webhook_signature

        # Empty signature header
        mock_request.headers = {"x-vapi-signature": ""}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_empty_secret_fails(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
    ) -> None:
        """Test that empty VAPI_SERVER_SECRET causes rejection (fail closed).

        Verifies that when VAPI_SERVER_SECRET is not configured or empty,
        all requests are rejected to ensure fail-closed behavior.
        """
        from app.api.auth import verify_webhook_signature

        # Generate a signature (doesn't matter what secret we use, server has none)
        signature = generate_signature(sample_payload, "any-secret")
        mock_request.headers = {"x-vapi-signature": signature}

        # Mock empty secret
        with patch.dict(os.environ, {"VAPI_SERVER_SECRET": ""}):
            with pytest.raises(HTTPException) as exc_info:
                await verify_webhook_signature(mock_request)

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_missing_secret_env_var_fails(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
    ) -> None:
        """Test that missing VAPI_SERVER_SECRET env var causes rejection.

        Verifies that when VAPI_SERVER_SECRET environment variable
        is not set at all, requests are rejected (fail closed).
        """
        from app.api.auth import verify_webhook_signature

        signature = generate_signature(sample_payload, "any-secret")
        mock_request.headers = {"x-vapi-signature": signature}

        # Ensure env var is not set
        env_copy = os.environ.copy()
        if "VAPI_SERVER_SECRET" in env_copy:
            del env_copy["VAPI_SERVER_SECRET"]

        with patch.dict(os.environ, env_copy, clear=True):
            with pytest.raises(HTTPException) as exc_info:
                await verify_webhook_signature(mock_request)

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_tampered_payload_rejected(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that a tampered payload is rejected.

        Verifies that if the request body is modified after the signature
        was computed, the verification fails.
        """
        from app.api.auth import verify_webhook_signature

        # Generate signature for original payload
        signature = generate_signature(sample_payload, TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {"x-vapi-signature": signature}

        # Return different payload (simulating tampering)
        tampered_payload = b'{"type": "malicious-event", "data": {}}'
        mock_request.body = AsyncMock(return_value=tampered_payload)

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_signature_is_case_sensitive(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that signature comparison is case-sensitive.

        Verifies that the hexdigest comparison treats uppercase and
        lowercase characters as different (standard hex behavior).
        """
        from app.api.auth import verify_webhook_signature

        # Generate valid signature (lowercase hex)
        signature = generate_signature(sample_payload, TEST_VAPI_SERVER_SECRET)
        # Convert to uppercase to test case sensitivity
        mock_request.headers = {"x-vapi-signature": signature.upper()}

        # If original was lowercase, uppercase should fail
        # (hmac.hexdigest returns lowercase)
        if signature != signature.upper():
            with pytest.raises(HTTPException) as exc_info:
                await verify_webhook_signature(mock_request)

            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_raw_payload_bytes(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that the function returns the raw payload as bytes.

        Verifies that on successful verification, the exact bytes
        from the request body are returned for subsequent parsing.
        """
        from app.api.auth import verify_webhook_signature

        signature = generate_signature(sample_payload, TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {"x-vapi-signature": signature}

        result = await verify_webhook_signature(mock_request)

        # Verify it's bytes and matches exactly
        assert isinstance(result, bytes)
        assert result == sample_payload

    @pytest.mark.asyncio
    async def test_reads_body_only_once(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that request.body() is called only once.

        Verifies that the function reads the body exactly once,
        which is important for proper request handling.
        """
        from app.api.auth import verify_webhook_signature

        signature = generate_signature(sample_payload, TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {"x-vapi-signature": signature}

        await verify_webhook_signature(mock_request)

        # Verify body was called exactly once
        mock_request.body.assert_called_once()
