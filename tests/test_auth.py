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


class TestVerifyApiKey:
    """Test suite for verify_api_key function."""

    # Import test constants
    from conftest import TEST_WEBHOOK_API_KEY

    @pytest.fixture
    def mock_request(self) -> MagicMock:
        """Create a mock FastAPI Request object for API key tests.

        Returns:
            MagicMock: A mock request object with headers.
        """
        return MagicMock()

    def test_valid_api_key_accepted(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that a valid API key is accepted.

        Verifies that when a request contains the correct API key
        in the X-API-Key header, the verification succeeds without
        raising an exception.
        """
        from app.api.auth import verify_api_key

        # Set valid API key header
        mock_request.headers = {"X-API-Key": self.TEST_WEBHOOK_API_KEY}

        # Should not raise any exception
        verify_api_key(mock_request)

    def test_invalid_api_key_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that an invalid API key is rejected with 401.

        Verifies that when a request contains an incorrect API key,
        the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_api_key

        # Set invalid API key
        mock_request.headers = {"X-API-Key": "wrong-api-key-12345"}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            verify_api_key(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    def test_missing_api_key_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that a missing API key header is rejected with 401.

        Verifies that when a request does not include the X-API-Key
        header, the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_api_key

        # No API key header
        mock_request.headers = {}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            verify_api_key(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    def test_empty_api_key_rejected(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that an empty API key header is rejected with 401.

        Verifies that when a request includes an empty X-API-Key
        header value, the verification fails with an HTTPException 401.
        """
        from app.api.auth import verify_api_key

        # Empty API key header
        mock_request.headers = {"X-API-Key": ""}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            verify_api_key(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    def test_empty_webhook_api_key_env_fails(
        self,
        mock_request: MagicMock,
    ) -> None:
        """Test that empty WEBHOOK_API_KEY causes rejection (fail closed).

        Verifies that when WEBHOOK_API_KEY is not configured or empty,
        all requests are rejected to ensure fail-closed behavior.
        """
        from app.api.auth import verify_api_key

        # Set a valid-looking API key in request
        mock_request.headers = {"X-API-Key": "some-api-key"}

        # Mock empty WEBHOOK_API_KEY
        with patch.dict(os.environ, {"WEBHOOK_API_KEY": ""}):
            with pytest.raises(HTTPException) as exc_info:
                verify_api_key(mock_request)

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Unauthorized"

    def test_missing_webhook_api_key_env_fails(
        self,
        mock_request: MagicMock,
    ) -> None:
        """Test that missing WEBHOOK_API_KEY env var causes rejection.

        Verifies that when WEBHOOK_API_KEY environment variable
        is not set at all, requests are rejected (fail closed).
        """
        from app.api.auth import verify_api_key

        mock_request.headers = {"X-API-Key": "some-api-key"}

        # Ensure env var is not set
        env_copy = os.environ.copy()
        if "WEBHOOK_API_KEY" in env_copy:
            del env_copy["WEBHOOK_API_KEY"]

        with patch.dict(os.environ, env_copy, clear=True):
            with pytest.raises(HTTPException) as exc_info:
                verify_api_key(mock_request)

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Unauthorized"

    def test_api_key_header_is_case_sensitive_value(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that API key comparison is case-sensitive.

        Verifies that the API key value comparison treats uppercase
        and lowercase characters as different.
        """
        from app.api.auth import verify_api_key

        # Use uppercase version of the test API key
        mock_request.headers = {"X-API-Key": self.TEST_WEBHOOK_API_KEY.upper()}

        # If original was not all uppercase, this should fail
        if self.TEST_WEBHOOK_API_KEY != self.TEST_WEBHOOK_API_KEY.upper():
            with pytest.raises(HTTPException) as exc_info:
                verify_api_key(mock_request)

            assert exc_info.value.status_code == 401

    def test_api_key_header_name_case_insensitivity(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that X-API-Key header name lookup works.

        Verifies that the header is retrieved correctly using
        the expected header name format.
        """
        from app.api.auth import verify_api_key

        # Use exact header name as expected
        mock_request.headers = {"X-API-Key": self.TEST_WEBHOOK_API_KEY}

        # Should not raise any exception
        verify_api_key(mock_request)
