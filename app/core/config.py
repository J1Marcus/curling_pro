"""Centralized application configuration using Pydantic Settings."""

from typing import Optional

from pydantic import Field, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application configuration using Pydantic Settings.

    All environment variables are loaded from .env file with case-insensitive
    matching. Extra environment variables are ignored to allow for flexibility.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    project_name: str = Field(default="launchpad", description="Application name")

    # Database
    database_host: str = Field(default="localhost", description="PostgreSQL host")
    database_port: int = Field(
        default=5432, ge=1, le=65535, description="PostgreSQL port"
    )
    database_name: str = Field(default="postgres", description="Database name")
    database_user: str = Field(default="postgres", description="Database user")
    database_password: SecretStr = Field(
        default="postgres", description="Database password"
    )

    @computed_field
    @property
    def database_url(self) -> str:
        """Construct PostgreSQL connection string."""
        password = self.database_password.get_secret_value()
        return f"postgresql://{self.database_user}:{password}@{self.database_host}:{self.database_port}/{self.database_name}"

    # Redis
    redis_host: str = Field(default="redis", description="Redis host")
    redis_port: int = Field(
        default=6379, ge=1, le=65535, description="Redis port"
    )
    redis_db: int = Field(default=0, ge=0, description="Redis database number")

    @computed_field
    @property
    def redis_url(self) -> str:
        """Construct Redis connection string."""
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # LLM Providers - OpenAI
    openai_api_key: Optional[SecretStr] = Field(
        default=None, description="OpenAI API key"
    )

    # LLM Providers - Azure OpenAI
    azure_openai_endpoint: Optional[str] = Field(
        default=None, description="Azure OpenAI endpoint URL"
    )
    azure_openai_api_key: Optional[SecretStr] = Field(
        default=None, description="Azure OpenAI API key"
    )
    openai_api_version: str = Field(
        default="2024-07-01-preview", description="OpenAI API version for Azure OpenAI"
    )

    # LLM Providers - Anthropic
    anthropic_api_key: Optional[SecretStr] = Field(
        default=None, description="Anthropic API key for Claude models"
    )

    # LLM Providers - Google
    google_api_key: Optional[SecretStr] = Field(
        default=None, description="Google AI API key"
    )
    google_application_credentials: Optional[str] = Field(
        default=None, description="Path to Google service account JSON file"
    )
    google_vertex_ai_location: str = Field(
        default="europe-west1", description="Google Vertex AI region"
    )

    # LLM Providers - Ollama
    ollama_base_url: Optional[str] = Field(
        default="http://localhost:11434/v1", description="Ollama base URL for local LLM inference"
    )

    # LLM Providers - AWS Bedrock
    bedrock_aws_access_key_id: Optional[SecretStr] = Field(
        default=None, description="AWS access key ID for Bedrock"
    )
    bedrock_aws_secret_access_key: Optional[SecretStr] = Field(
        default=None, description="AWS secret access key for Bedrock"
    )
    bedrock_aws_region: Optional[str] = Field(
        default=None, description="AWS region for Bedrock"
    )

    # Observability - Langfuse
    langfuse_secret_key: Optional[SecretStr] = Field(
        default=None, description="Langfuse secret key for authentication"
    )
    langfuse_public_key: Optional[str] = Field(
        default=None, description="Langfuse public key for project identification"
    )
    langfuse_base_url: str = Field(
        default="https://cloud.langfuse.com", description="Langfuse API base URL"
    )

    # VAPI Integration
    vapi_api_key: Optional[SecretStr] = Field(
        default=None, description="VAPI API key for voice AI integration"
    )
    vapi_server_secret: Optional[SecretStr] = Field(
        default=None, description="VAPI server secret for webhook authentication"
    )
    backend_url: str = Field(
        default="http://localhost:8080", description="Backend URL for VAPI callbacks"
    )


# Singleton instance for easy import
settings = Settings()
