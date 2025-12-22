"""Centralized application configuration using Pydantic Settings."""

from pydantic import Field
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
