"""
Pytest Configuration and Fixtures

This module provides shared fixtures for testing the webhook authentication
functionality and FastAPI endpoints.
"""

import hashlib
import hmac
import os
import sys
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Add app directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from main import app
from database.session import db_session


# Test constants - never use real secrets in tests
TEST_VAPI_SERVER_SECRET = "test-vapi-server-secret-12345"
TEST_WEBHOOK_API_KEY = "test-webhook-api-key-67890"


@pytest.fixture
def test_vapi_secret() -> str:
    """Provide test VAPI server secret."""
    return TEST_VAPI_SERVER_SECRET


@pytest.fixture
def test_api_key() -> str:
    """Provide test webhook API key."""
    return TEST_WEBHOOK_API_KEY


@pytest.fixture
def mock_env_vars() -> Generator[None, None, None]:
    """Mock environment variables for webhook authentication.

    This fixture sets up the required environment variables for testing:
    - VAPI_SERVER_SECRET: Used for HMAC signature verification
    - WEBHOOK_API_KEY: Used for API key authentication

    Yields:
        None: The environment variables are available during the test.
    """
    env_vars = {
        "VAPI_SERVER_SECRET": TEST_VAPI_SERVER_SECRET,
        "WEBHOOK_API_KEY": TEST_WEBHOOK_API_KEY,
    }
    with patch.dict(os.environ, env_vars):
        yield


@pytest.fixture
def mock_env_empty_secret() -> Generator[None, None, None]:
    """Mock environment with empty VAPI_SERVER_SECRET.

    Used to test fail-closed behavior when secret is not configured.
    """
    env_vars = {
        "VAPI_SERVER_SECRET": "",
        "WEBHOOK_API_KEY": TEST_WEBHOOK_API_KEY,
    }
    with patch.dict(os.environ, env_vars, clear=False):
        yield


@pytest.fixture
def mock_env_empty_api_key() -> Generator[None, None, None]:
    """Mock environment with empty WEBHOOK_API_KEY.

    Used to test fail-closed behavior when API key is not configured.
    """
    env_vars = {
        "VAPI_SERVER_SECRET": TEST_VAPI_SERVER_SECRET,
        "WEBHOOK_API_KEY": "",
    }
    with patch.dict(os.environ, env_vars, clear=False):
        yield


def mock_db_session() -> Generator[MagicMock, None, None]:
    """Create a mock database session for testing."""
    mock_session = MagicMock()
    yield mock_session


@pytest.fixture
def client(mock_env_vars: None) -> Generator[TestClient, None, None]:
    """Create FastAPI test client with mocked environment variables.

    Args:
        mock_env_vars: Fixture that sets up required environment variables.

    Yields:
        TestClient: A test client for making requests to the FastAPI app.
    """
    # Override the database session dependency with a mock
    app.dependency_overrides[db_session] = mock_db_session

    # Mock celery task sending, workflow registry, and repository
    with patch("api.events.celery_app") as mock_celery, \
         patch("api.events.get_workflow_type", return_value="test_workflow"), \
         patch("api.events.GenericRepository") as mock_repo_class:
        mock_celery.send_task.return_value = "test-task-id-12345"
        mock_repo = MagicMock()
        mock_repo_class.return_value = mock_repo
        with TestClient(app) as test_client:
            yield test_client

    # Clean up the override
    app.dependency_overrides.clear()


@pytest.fixture
def client_no_mock() -> Generator[TestClient, None, None]:
    """Create FastAPI test client without mocked environment variables.

    Used for testing behavior when environment variables are not set.
    """
    with TestClient(app) as test_client:
        yield test_client


def generate_signature(payload: bytes, secret: str) -> str:
    """Generate HMAC-SHA256 signature for a payload.

    This helper function creates a valid signature that matches
    the format expected by the webhook authentication.

    Args:
        payload: The raw request body as bytes.
        secret: The VAPI server secret.

    Returns:
        str: The hex-encoded HMAC-SHA256 signature.
    """
    return hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()


@pytest.fixture
def signature_generator() -> Any:
    """Provide signature generator function as a fixture.

    Returns:
        Callable: The generate_signature function.
    """
    return generate_signature


@pytest.fixture
def sample_payload() -> bytes:
    """Provide a sample webhook payload for testing.

    Returns:
        bytes: A JSON-encoded sample event payload.
    """
    return b'{"type": "test-event", "data": {"key": "value"}}'


@pytest.fixture
def sample_payload_dict() -> dict[str, Any]:
    """Provide sample payload as dictionary for assertions.

    Returns:
        dict: The sample event payload as a dictionary.
    """
    return {"type": "test-event", "data": {"key": "value"}}


@pytest.fixture
def valid_auth_headers(
    sample_payload: bytes,
    test_vapi_secret: str,
    test_api_key: str,
) -> dict[str, str]:
    """Generate valid authentication headers for testing.

    Args:
        sample_payload: The request payload bytes.
        test_vapi_secret: The test VAPI server secret.
        test_api_key: The test webhook API key.

    Returns:
        dict: Headers with valid signature and API key.
    """
    signature = generate_signature(sample_payload, test_vapi_secret)
    return {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
        "X-API-Key": test_api_key,
    }


@pytest.fixture
def invalid_signature_headers(test_api_key: str) -> dict[str, str]:
    """Generate headers with invalid signature for testing.

    Args:
        test_api_key: The test webhook API key.

    Returns:
        dict: Headers with invalid signature but valid API key.
    """
    return {
        "Content-Type": "application/json",
        "x-vapi-signature": "invalid-signature-12345",
        "X-API-Key": test_api_key,
    }


@pytest.fixture
def missing_signature_headers(test_api_key: str) -> dict[str, str]:
    """Generate headers without signature for testing.

    Args:
        test_api_key: The test webhook API key.

    Returns:
        dict: Headers with API key but no signature.
    """
    return {
        "Content-Type": "application/json",
        "X-API-Key": test_api_key,
    }


@pytest.fixture
def missing_api_key_headers(
    sample_payload: bytes,
    test_vapi_secret: str,
) -> dict[str, str]:
    """Generate headers without API key for testing.

    Args:
        sample_payload: The request payload bytes.
        test_vapi_secret: The test VAPI server secret.

    Returns:
        dict: Headers with valid signature but no API key.
    """
    signature = generate_signature(sample_payload, test_vapi_secret)
    return {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
    }


@pytest.fixture
def invalid_api_key_headers(
    sample_payload: bytes,
    test_vapi_secret: str,
) -> dict[str, str]:
    """Generate headers with invalid API key for testing.

    Args:
        sample_payload: The request payload bytes.
        test_vapi_secret: The test VAPI server secret.

    Returns:
        dict: Headers with valid signature but invalid API key.
    """
    signature = generate_signature(sample_payload, test_vapi_secret)
    return {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
        "X-API-Key": "wrong-api-key",
    }
