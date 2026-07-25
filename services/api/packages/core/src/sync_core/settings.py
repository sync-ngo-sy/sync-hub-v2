"""Process configuration, loaded from the environment.

Nothing here has a secret for a default. Every deployment supplies the real values as
environment variables (`SYNC_` prefixed); `services/api/.env` is the local-development
convenience and is git-ignored.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import AnyHttpUrl, Field, PostgresDsn, SecretStr, UrlConstraints
from pydantic_settings import BaseSettings, SettingsConfigDict

AsyncPostgresDsn = Annotated[PostgresDsn, UrlConstraints(allowed_schemes=["postgresql+asyncpg"])]


class Environment(StrEnum):
    """Where the process is running."""

    LOCAL = "local"
    CI = "ci"
    PRODUCTION = "production"


class LogFormat(StrEnum):
    JSON = "json"
    CONSOLE = "console"


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Settings(BaseSettings):
    """The whole process configuration. Read it through `get_settings()`."""

    model_config = SettingsConfigDict(
        env_prefix="SYNC_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    environment: Environment = Environment.LOCAL

    # Postgres, connected to directly with the service role (ADR-0004).
    database_url: AsyncPostgresDsn
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=10, ge=0)
    database_echo: bool = False

    # Supabase, used only as a GoTrue/Storage HTTP client (ADR-0004). The service-role key
    # is the secret this whole class exists to keep out of the source.
    supabase_url: AnyHttpUrl
    supabase_service_role_key: SecretStr
    supabase_anon_key: SecretStr

    log_level: LogLevel = LogLevel.INFO
    log_format: LogFormat = LogFormat.JSON


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The process-wide settings, read from the environment once.

    Cached, so tests that change the environment must call `get_settings.cache_clear()`.
    """
    return Settings()  # pyright: ignore[reportCallIssue]  — values come from the environment
