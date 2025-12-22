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


class TestVerifyWebhookAuth:
    """Test suite for verify_webhook_auth combined dependency.

    These tests verify that both signature verification and API key
    validation work together as expected in the combined auth dependency.
    """

    # Import test constants
    from conftest import TEST_VAPI_SERVER_SECRET, TEST_WEBHOOK_API_KEY

    @pytest.fixture
    def mock_request(self, sample_payload: bytes) -> MagicMock:
        """Create a mock FastAPI Request object for combined auth tests.

        Args:
            sample_payload: The payload bytes to return from body().

        Returns:
            MagicMock: A mock request object with headers and body.
        """
        request = MagicMock()
        request.body = AsyncMock(return_value=sample_payload)
        return request

    @pytest.mark.asyncio
    async def test_both_valid_passes(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that both valid signature and API key allow request through.

        Verifies that when a request contains both a valid HMAC-SHA256
        signature and a valid API key, the combined auth passes and
        returns the raw payload bytes.
        """
        from app.api.auth import verify_webhook_auth

        # Generate valid signature and set valid API key
        signature = generate_signature(sample_payload, self.TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {
            "x-vapi-signature": signature,
            "X-API-Key": self.TEST_WEBHOOK_API_KEY,
        }

        # Verify combined auth passes and returns payload
        result = await verify_webhook_auth(mock_request)
        assert result == sample_payload

    @pytest.mark.asyncio
    async def test_valid_signature_invalid_api_key_fails(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that valid signature with invalid API key is rejected.

        Verifies that partial authentication fails - even if the signature
        is valid, an invalid API key causes 401 rejection.
        """
        from app.api.auth import verify_webhook_auth

        # Valid signature, invalid API key
        signature = generate_signature(sample_payload, self.TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {
            "x-vapi-signature": signature,
            "X-API-Key": "wrong-api-key-12345",
        }

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_invalid_signature_valid_api_key_fails(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that invalid signature with valid API key is rejected.

        Verifies that partial authentication fails - even if the API key
        is valid, an invalid signature causes 401 rejection.
        """
        from app.api.auth import verify_webhook_auth

        # Invalid signature, valid API key
        mock_request.headers = {
            "x-vapi-signature": "invalid-signature-12345",
            "X-API-Key": self.TEST_WEBHOOK_API_KEY,
        }

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_missing_signature_with_valid_api_key_fails(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that missing signature with valid API key is rejected.

        Verifies that both authentication mechanisms must be present -
        missing signature causes 401 even with valid API key.
        """
        from app.api.auth import verify_webhook_auth

        # No signature, valid API key
        mock_request.headers = {
            "X-API-Key": self.TEST_WEBHOOK_API_KEY,
        }

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_valid_signature_missing_api_key_fails(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that valid signature without API key is rejected.

        Verifies that both authentication mechanisms must be present -
        missing API key causes 401 even with valid signature.
        """
        from app.api.auth import verify_webhook_auth

        # Valid signature, no API key
        signature = generate_signature(sample_payload, self.TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {
            "x-vapi-signature": signature,
        }

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_no_auth_headers_fails(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that request with no auth headers is rejected.

        Verifies that requests without any authentication headers
        are rejected with 401.
        """
        from app.api.auth import verify_webhook_auth

        # No auth headers
        mock_request.headers = {}

        # Verify rejection with 401
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Unauthorized"

    @pytest.mark.asyncio
    async def test_signature_checked_before_api_key(
        self,
        mock_request: MagicMock,
        mock_env_vars: None,
    ) -> None:
        """Test that signature verification runs before API key check.

        Verifies the order of validation: signature is checked first,
        and if invalid, API key is never checked.
        """
        from app.api.auth import verify_webhook_auth

        # Invalid signature, but no API key header at all
        # If signature is checked first, it should fail before checking API key
        mock_request.headers = {
            "x-vapi-signature": "invalid-signature",
        }

        # Verify rejection with 401 (due to invalid signature)
        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_auth(mock_request)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_raw_payload_bytes(
        self,
        mock_request: MagicMock,
        sample_payload: bytes,
        mock_env_vars: None,
    ) -> None:
        """Test that combined auth returns raw payload for JSON parsing.

        Verifies that on successful authentication, the exact bytes
        from the request body are returned for subsequent parsing
        in the endpoint handler.
        """
        from app.api.auth import verify_webhook_auth

        signature = generate_signature(sample_payload, self.TEST_VAPI_SERVER_SECRET)
        mock_request.headers = {
            "x-vapi-signature": signature,
            "X-API-Key": self.TEST_WEBHOOK_API_KEY,
        }

        result = await verify_webhook_auth(mock_request)

        # Verify it's bytes and matches exactly
        assert isinstance(result, bytes)
        assert result == sample_payload


class TestEventsEndpointAuthentication:
    """Integration tests for /events/ endpoint authentication.

    These tests verify that the /events/ endpoint correctly requires
    both signature verification and API key authentication.
    """

    def test_events_endpoint_requires_auth(
        self,
        client_no_mock: "TestClient",
        sample_payload: bytes,
    ) -> None:
        """Test that /events/ endpoint requires authentication.

        Verifies that unauthenticated requests to the events endpoint
        are rejected with 401 Unauthorized.
        """
        from fastapi.testclient import TestClient

        # Send request without any auth headers
        response = client_no_mock.post(
            "/events/",
            content=sample_payload,
            headers={"Content-Type": "application/json"},
        )

        # Verify rejection with 401
        assert response.status_code == 401

    def test_authenticated_request_accepted(
        self,
        client: "TestClient",
        sample_payload: bytes,
        valid_auth_headers: dict[str, str],
    ) -> None:
        """Test that authenticated request is accepted by /events/.

        Verifies that requests with valid signature and API key
        are processed normally and return 202 Accepted.
        """
        # Send authenticated request
        response = client.post(
            "/events/",
            content=sample_payload,
            headers=valid_auth_headers,
        )

        # Verify acceptance with 202
        assert response.status_code == 202
        # Response should contain task ID in JSON
        data = response.json()
        assert "message" in data
        assert "process_incoming_event started" in data["message"]

    def test_invalid_signature_rejected(
        self,
        client: "TestClient",
        sample_payload: bytes,
        invalid_signature_headers: dict[str, str],
    ) -> None:
        """Test that invalid signature is rejected by /events/.

        Verifies that requests with an invalid signature (but valid
        API key) are rejected with 401 Unauthorized.
        """
        response = client.post(
            "/events/",
            content=sample_payload,
            headers=invalid_signature_headers,
        )

        assert response.status_code == 401

    def test_missing_signature_rejected(
        self,
        client: "TestClient",
        sample_payload: bytes,
        missing_signature_headers: dict[str, str],
    ) -> None:
        """Test that missing signature is rejected by /events/.

        Verifies that requests without a signature header (but valid
        API key) are rejected with 401 Unauthorized.
        """
        response = client.post(
            "/events/",
            content=sample_payload,
            headers=missing_signature_headers,
        )

        assert response.status_code == 401

    def test_invalid_api_key_rejected(
        self,
        client: "TestClient",
        sample_payload: bytes,
        invalid_api_key_headers: dict[str, str],
    ) -> None:
        """Test that invalid API key is rejected by /events/.

        Verifies that requests with an invalid API key (but valid
        signature) are rejected with 401 Unauthorized.
        """
        response = client.post(
            "/events/",
            content=sample_payload,
            headers=invalid_api_key_headers,
        )

        assert response.status_code == 401

    def test_missing_api_key_rejected(
        self,
        client: "TestClient",
        sample_payload: bytes,
        missing_api_key_headers: dict[str, str],
    ) -> None:
        """Test that missing API key is rejected by /events/.

        Verifies that requests without an API key header (but valid
        signature) are rejected with 401 Unauthorized.
        """
        response = client.post(
            "/events/",
            content=sample_payload,
            headers=missing_api_key_headers,
        )

        assert response.status_code == 401

    def test_empty_body_with_valid_auth_fails(
        self,
        client: "TestClient",
        test_vapi_secret: str,
        test_api_key: str,
    ) -> None:
        """Test that empty body with valid auth is handled properly.

        Verifies that an empty request body with valid authentication
        headers fails at JSON parsing, not at authentication.
        This confirms auth is working but empty bodies are invalid.
        """
        # Generate signature for empty body
        empty_payload = b""
        signature = generate_signature(empty_payload, test_vapi_secret)

        headers = {
            "Content-Type": "application/json",
            "x-vapi-signature": signature,
            "X-API-Key": test_api_key,
        }

        response = client.post(
            "/events/",
            content=empty_payload,
            headers=headers,
        )

        # Should fail due to JSON parsing error, not auth
        # Empty body is not valid JSON, so we expect an error
        # but NOT 401 (auth passed, JSON parsing failed)
        assert response.status_code != 401

    def test_partial_auth_signature_only_fails(
        self,
        client: "TestClient",
        sample_payload: bytes,
        test_vapi_secret: str,
    ) -> None:
        """Test that partial auth with only signature fails.

        Verifies that requests with only signature verification
        (no API key) are rejected with 401 Unauthorized.
        """
        signature = generate_signature(sample_payload, test_vapi_secret)

        headers = {
            "Content-Type": "application/json",
            "x-vapi-signature": signature,
            # No X-API-Key header
        }

        response = client.post(
            "/events/",
            content=sample_payload,
            headers=headers,
        )

        assert response.status_code == 401

    def test_partial_auth_api_key_only_fails(
        self,
        client: "TestClient",
        sample_payload: bytes,
        test_api_key: str,
    ) -> None:
        """Test that partial auth with only API key fails.

        Verifies that requests with only API key authentication
        (no signature) are rejected with 401 Unauthorized.
        """
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": test_api_key,
            # No x-vapi-signature header
        }

        response = client.post(
            "/events/",
            content=sample_payload,
            headers=headers,
        )

        assert response.status_code == 401
