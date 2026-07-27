from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import AnyHttpUrl, Field, PostgresDsn, SecretStr, UrlConstraints
from pydantic_settings import BaseSettings, SettingsConfigDict

AsyncPostgresDsn = Annotated[PostgresDsn, UrlConstraints(allowed_schemes=["postgresql+asyncpg"])]


class Environment(StrEnum):
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


class SameSite(StrEnum):
    LAX = "lax"
    STRICT = "strict"
    NONE = "none"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SYNC_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    environment: Environment = Environment.LOCAL

    database_url: AsyncPostgresDsn
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=10, ge=0)
    database_echo: bool = False

    supabase_url: AnyHttpUrl
    supabase_service_role_key: SecretStr
    supabase_anon_key: SecretStr

    auth_cookie_secure: bool = True
    auth_cookie_same_site: SameSite = SameSite.LAX
    auth_cookie_domain: str | None = None
    auth_rate_limit_max_requests: int = Field(default=20, ge=1)
    auth_rate_limit_window_seconds: float = Field(default=60.0, gt=0)
    recruiter_portal_url: AnyHttpUrl

    public_rate_limit_max_requests: int = Field(default=120, ge=1)
    public_rate_limit_window_seconds: float = Field(default=60.0, gt=0)
    visitor_hash_salt: SecretStr | None = None

    cv_max_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    cv_download_url_ttl_seconds: int = Field(default=300, gt=0)

    openai_api_key: SecretStr | None = None
    openai_cv_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_timeout_seconds: float = Field(default=120.0, gt=0)

    resend_api_key: SecretStr | None = None
    #: Resend's sandbox sender, which needs no verified domain. Every deployment that sends
    #: to a real address overrides it with one of its own.
    email_from: str = "Sync <onboarding@resend.dev>"
    email_timeout_seconds: int = Field(default=30, gt=0)

    worker_poll_interval_seconds: float = Field(default=1.0, gt=0)
    worker_idle_backoff_max_seconds: float = Field(default=15.0, gt=0)
    worker_max_attempts: int = Field(default=3, ge=1)
    worker_retry_backoff_seconds: float = Field(default=10.0, gt=0)
    worker_stuck_job_seconds: float = Field(default=600.0, gt=0)
    worker_sweep_interval_seconds: float = Field(default=60.0, gt=0)
    worker_ingestion_concurrency: int = Field(default=4, ge=1)
    worker_embedding_concurrency: int = Field(default=2, ge=1)
    worker_communications_concurrency: int = Field(default=2, ge=1)

    log_level: LogLevel = LogLevel.INFO
    log_format: LogFormat = LogFormat.JSON

    @property
    def gotrue_url(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"

    @property
    def storage_url(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/storage/v1"

    @property
    def visitor_hash_secret(self) -> str:
        """What Job view events are salted with — never a constant this repository ships.

        Unset, it falls back to the service-role key: already a per-deployment secret, so an
        analytics table still cannot be walked back to the addresses it was built from.
        """
        salt = self.visitor_hash_salt or self.supabase_service_role_key
        return salt.get_secret_value()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
