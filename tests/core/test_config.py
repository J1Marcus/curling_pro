"""Unit tests for the Settings configuration class."""

import os
from unittest.mock import patch

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


class TestSettingsDefaults:
    """Test that Settings class loads with correct default values."""

    def test_project_name_default(self) -> None:
        """Settings uses 'launchpad' as default project name."""
        settings = Settings(_env_file=None)
        assert settings.project_name == "launchpad"

    def test_database_defaults(self) -> None:
        """Settings uses correct database defaults."""
        settings = Settings(_env_file=None)
        assert settings.database_host == "localhost"
        assert settings.database_port == 5432
        assert settings.database_name == "postgres"
        assert settings.database_user == "postgres"
        assert settings.database_password.get_secret_value() == "postgres"

    def test_redis_defaults(self) -> None:
        """Settings uses correct Redis defaults."""
        settings = Settings(_env_file=None)
        assert settings.redis_host == "redis"
        assert settings.redis_port == 6379
        assert settings.redis_db == 0

    def test_openai_api_version_default(self) -> None:
        """Settings uses correct OpenAI API version default."""
        settings = Settings(_env_file=None)
        assert settings.openai_api_version == "2024-07-01-preview"

    def test_google_vertex_ai_location_default(self) -> None:
        """Settings uses correct Google Vertex AI location default."""
        settings = Settings(_env_file=None)
        assert settings.google_vertex_ai_location == "europe-west1"

    def test_langfuse_base_url_default(self) -> None:
        """Settings uses correct Langfuse base URL default."""
        settings = Settings(_env_file=None)
        assert settings.langfuse_base_url == "https://cloud.langfuse.com"

    def test_backend_url_default(self) -> None:
        """Settings uses correct backend URL default."""
        settings = Settings(_env_file=None)
        assert settings.backend_url == "http://localhost:8080"

    def test_ollama_base_url_default(self) -> None:
        """Settings uses correct Ollama base URL default."""
        settings = Settings(_env_file=None)
        assert settings.ollama_base_url == "http://localhost:11434/v1"

    def test_optional_fields_default_to_none(self) -> None:
        """Optional API key fields default to None."""
        settings = Settings(_env_file=None)
        assert settings.openai_api_key is None
        assert settings.azure_openai_endpoint is None
        assert settings.azure_openai_api_key is None
        assert settings.anthropic_api_key is None
        assert settings.google_api_key is None
        assert settings.google_application_credentials is None
        assert settings.bedrock_aws_access_key_id is None
        assert settings.bedrock_aws_secret_access_key is None
        assert settings.bedrock_aws_region is None
        assert settings.langfuse_secret_key is None
        assert settings.langfuse_public_key is None
        assert settings.vapi_api_key is None
        assert settings.vapi_server_secret is None


class TestSettingsEnvironmentOverrides:
    """Test that environment variables override default values."""

    def test_project_name_from_env(self) -> None:
        """PROJECT_NAME environment variable overrides default."""
        with patch.dict(os.environ, {"PROJECT_NAME": "my-custom-project"}):
            settings = Settings(_env_file=None)
            assert settings.project_name == "my-custom-project"

    def test_database_settings_from_env(self) -> None:
        """Database environment variables override defaults."""
        env_vars = {
            "DATABASE_HOST": "db.example.com",
            "DATABASE_PORT": "5433",
            "DATABASE_NAME": "mydb",
            "DATABASE_USER": "admin",
            "DATABASE_PASSWORD": "secret123",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            assert settings.database_host == "db.example.com"
            assert settings.database_port == 5433
            assert settings.database_name == "mydb"
            assert settings.database_user == "admin"
            assert settings.database_password.get_secret_value() == "secret123"

    def test_redis_settings_from_env(self) -> None:
        """Redis environment variables override defaults."""
        env_vars = {
            "REDIS_HOST": "redis.example.com",
            "REDIS_PORT": "6380",
            "REDIS_DB": "1",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            assert settings.redis_host == "redis.example.com"
            assert settings.redis_port == 6380
            assert settings.redis_db == 1

    def test_api_keys_from_env(self) -> None:
        """API key environment variables are loaded correctly."""
        env_vars = {
            "OPENAI_API_KEY": "sk-test123",
            "ANTHROPIC_API_KEY": "sk-ant-test456",
            "AZURE_OPENAI_API_KEY": "azure-key-789",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            assert settings.openai_api_key is not None
            assert settings.openai_api_key.get_secret_value() == "sk-test123"
            assert settings.anthropic_api_key is not None
            assert settings.anthropic_api_key.get_secret_value() == "sk-ant-test456"
            assert settings.azure_openai_api_key is not None
            assert settings.azure_openai_api_key.get_secret_value() == "azure-key-789"

    def test_case_insensitive_env_vars(self) -> None:
        """Environment variables are matched case-insensitively."""
        with patch.dict(os.environ, {"project_name": "lowercase-project"}):
            settings = Settings(_env_file=None)
            assert settings.project_name == "lowercase-project"


class TestDatabaseUrlComputedProperty:
    """Test the database_url computed property."""

    def test_database_url_with_defaults(self) -> None:
        """database_url is constructed correctly with default values."""
        settings = Settings(_env_file=None)
        expected = "postgresql://postgres:postgres@localhost:5432/postgres"
        assert settings.database_url == expected

    def test_database_url_with_custom_values(self) -> None:
        """database_url is constructed correctly with custom values."""
        env_vars = {
            "DATABASE_HOST": "db.example.com",
            "DATABASE_PORT": "5433",
            "DATABASE_NAME": "production",
            "DATABASE_USER": "admin",
            "DATABASE_PASSWORD": "super-secret",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            expected = "postgresql://admin:super-secret@db.example.com:5433/production"
            assert settings.database_url == expected

    def test_database_url_with_special_characters_in_password(self) -> None:
        """database_url includes password with special characters."""
        env_vars = {
            "DATABASE_PASSWORD": "p@ss!word#123",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            assert "p@ss!word#123" in settings.database_url


class TestRedisUrlComputedProperty:
    """Test the redis_url computed property."""

    def test_redis_url_with_defaults(self) -> None:
        """redis_url is constructed correctly with default values."""
        settings = Settings(_env_file=None)
        expected = "redis://redis:6379/0"
        assert settings.redis_url == expected

    def test_redis_url_with_custom_values(self) -> None:
        """redis_url is constructed correctly with custom values."""
        env_vars = {
            "REDIS_HOST": "redis.example.com",
            "REDIS_PORT": "6380",
            "REDIS_DB": "2",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            expected = "redis://redis.example.com:6380/2"
            assert settings.redis_url == expected


class TestSecretStrProtection:
    """Test that sensitive values are protected with SecretStr."""

    def test_database_password_is_secret_str(self) -> None:
        """database_password is a SecretStr type."""
        settings = Settings(_env_file=None)
        assert isinstance(settings.database_password, SecretStr)

    def test_database_password_repr_is_masked(self) -> None:
        """database_password string representation is masked."""
        settings = Settings(_env_file=None)
        password_str = str(settings.database_password)
        assert "postgres" not in password_str
        assert "**" in password_str

    def test_openai_api_key_is_secret_str(self) -> None:
        """openai_api_key is a SecretStr when set."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test123"}):
            settings = Settings(_env_file=None)
            assert isinstance(settings.openai_api_key, SecretStr)
            key_str = str(settings.openai_api_key)
            assert "sk-test123" not in key_str

    def test_settings_repr_masks_secrets(self) -> None:
        """Settings repr does not expose secret values."""
        env_vars = {
            "DATABASE_PASSWORD": "my-secret-password",
            "OPENAI_API_KEY": "sk-secret-key",
            "ANTHROPIC_API_KEY": "sk-ant-secret",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            settings_repr = repr(settings)
            assert "my-secret-password" not in settings_repr
            assert "sk-secret-key" not in settings_repr
            assert "sk-ant-secret" not in settings_repr

    def test_secret_value_accessible_via_get_secret_value(self) -> None:
        """Secret values are accessible via get_secret_value() method."""
        with patch.dict(os.environ, {"DATABASE_PASSWORD": "actual-secret"}):
            settings = Settings(_env_file=None)
            assert settings.database_password.get_secret_value() == "actual-secret"

    def test_all_api_keys_are_secret_str_when_set(self) -> None:
        """All API key fields use SecretStr when values are set."""
        env_vars = {
            "AZURE_OPENAI_API_KEY": "azure-key",
            "ANTHROPIC_API_KEY": "anthropic-key",
            "GOOGLE_API_KEY": "google-key",
            "BEDROCK_AWS_ACCESS_KEY_ID": "aws-access-key",
            "BEDROCK_AWS_SECRET_ACCESS_KEY": "aws-secret-key",
            "LANGFUSE_SECRET_KEY": "langfuse-key",
            "VAPI_API_KEY": "vapi-key",
            "VAPI_SERVER_SECRET": "vapi-secret",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings(_env_file=None)
            assert isinstance(settings.azure_openai_api_key, SecretStr)
            assert isinstance(settings.anthropic_api_key, SecretStr)
            assert isinstance(settings.google_api_key, SecretStr)
            assert isinstance(settings.bedrock_aws_access_key_id, SecretStr)
            assert isinstance(settings.bedrock_aws_secret_access_key, SecretStr)
            assert isinstance(settings.langfuse_secret_key, SecretStr)
            assert isinstance(settings.vapi_api_key, SecretStr)
            assert isinstance(settings.vapi_server_secret, SecretStr)


class TestPortValidation:
    """Test port validation for database and Redis ports."""

    def test_database_port_below_minimum_raises_error(self) -> None:
        """DATABASE_PORT below 1 raises ValidationError."""
        with patch.dict(os.environ, {"DATABASE_PORT": "0"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "database_port" in str(exc_info.value)

    def test_database_port_above_maximum_raises_error(self) -> None:
        """DATABASE_PORT above 65535 raises ValidationError."""
        with patch.dict(os.environ, {"DATABASE_PORT": "65536"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "database_port" in str(exc_info.value)

    def test_redis_port_below_minimum_raises_error(self) -> None:
        """REDIS_PORT below 1 raises ValidationError."""
        with patch.dict(os.environ, {"REDIS_PORT": "0"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "redis_port" in str(exc_info.value)

    def test_redis_port_above_maximum_raises_error(self) -> None:
        """REDIS_PORT above 65535 raises ValidationError."""
        with patch.dict(os.environ, {"REDIS_PORT": "99999"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "redis_port" in str(exc_info.value)

    def test_invalid_port_string_raises_error(self) -> None:
        """Non-numeric port value raises ValidationError."""
        with patch.dict(os.environ, {"DATABASE_PORT": "invalid"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "database_port" in str(exc_info.value)

    def test_valid_port_boundary_minimum(self) -> None:
        """Port value of 1 is accepted."""
        with patch.dict(os.environ, {"DATABASE_PORT": "1"}):
            settings = Settings(_env_file=None)
            assert settings.database_port == 1

    def test_valid_port_boundary_maximum(self) -> None:
        """Port value of 65535 is accepted."""
        with patch.dict(os.environ, {"DATABASE_PORT": "65535"}):
            settings = Settings(_env_file=None)
            assert settings.database_port == 65535

    def test_redis_db_negative_raises_error(self) -> None:
        """REDIS_DB below 0 raises ValidationError."""
        with patch.dict(os.environ, {"REDIS_DB": "-1"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings(_env_file=None)
            assert "redis_db" in str(exc_info.value)


class TestSettingsConfigModel:
    """Test Settings model configuration behavior."""

    def test_extra_env_vars_are_ignored(self) -> None:
        """Extra environment variables do not cause errors."""
        with patch.dict(os.environ, {"UNKNOWN_VARIABLE": "some_value"}):
            settings = Settings(_env_file=None)
            assert not hasattr(settings, "unknown_variable")

    def test_settings_can_be_instantiated_without_env_file(self) -> None:
        """Settings can be created without a .env file present."""
        settings = Settings(_env_file=None)
        assert settings is not None
        assert settings.project_name == "launchpad"
