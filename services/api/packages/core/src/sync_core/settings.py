from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import (
    AnyHttpUrl,
    Field,
    PostgresDsn,
    SecretStr,
    UrlConstraints,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

AsyncPostgresDsn = Annotated[PostgresDsn, UrlConstraints(allowed_schemes=["postgresql+asyncpg"])]


class Environment(StrEnum):
    LOCAL = "local"
    CI = "ci"
    STAGING = "staging"
    PRODUCTION = "production"

    @property
    def is_deployed(self) -> bool:
        """Staging is a deployed environment and gets production's rules, not local's.

        It shares a registrable domain with production, which is the only reason this
        distinction has to exist at all — see `_keep_session_cookies_host_only`.
        """
        return self in {Environment.STAGING, Environment.PRODUCTION}


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
    #: Sized for many short-lived Cloud Run instances rather than one long process: the
    #: transaction pooler does the real pooling, and every instance holding a large local
    #: pool is how the database's connection limit gets exhausted. Raise per deployment.
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=5, ge=0)
    database_echo: bool = False
    database_statement_timeout_ms: int = Field(default=15_000, ge=0)

    supabase_url: AnyHttpUrl
    supabase_service_role_key: SecretStr
    supabase_anon_key: SecretStr

    #: Origins allowed to call the API from a browser with credentials. Never a wildcard: the
    #: browser refuses `*` alongside credentials anyway, and an allowlist is the point.
    #:
    #: Plain strings rather than AnyHttpUrl, because pydantic renders a URL with a trailing
    #: slash and a browser's Origin header never has one — the comparison is literal, so
    #: "https://jobs.sync.ngo/" would match nothing.
    #: `NoDecode` because the field is a tuple, and pydantic-settings JSON-decodes a complex type
    #: inside the environment source — before any validator runs. `a,b` is not JSON, so the
    #: splitter below never got the chance and the process died at import with a bare
    #: JSONDecodeError. This is the annotation that hands the raw string to it instead.
    cors_allowed_origins: Annotated[tuple[str, ...], NoDecode] = ()

    auth_cookie_secure: bool = True
    auth_cookie_same_site: SameSite = SameSite.LAX
    #: Deliberately unset: a host-only cookie is what stops staging's session from being sent
    #: to production's API. Both are subdomains of one registrable domain, so a shared cookie
    #: domain would travel between them, and SameSite=Lax attaches the cookie cross-origin
    #: without one. Enforced below rather than merely documented.
    auth_cookie_domain: str | None = None
    auth_rate_limit_max_requests: int = Field(default=20, ge=1)
    auth_rate_limit_window_seconds: float = Field(default=60.0, gt=0)
    recruiter_portal_url: AnyHttpUrl
    admin_portal_url: AnyHttpUrl

    public_rate_limit_max_requests: int = Field(default=120, ge=1)
    public_rate_limit_window_seconds: float = Field(default=60.0, gt=0)
    visitor_hash_salt: SecretStr | None = None

    #: Asking for access is the one unauthenticated write on the platform, and it goes nowhere
    #: near the identity provider, so none of GoTrue's own limits cover it. A company asks once;
    #: anything submitting by the handful is a script.
    access_request_rate_limit_max_requests: int = Field(default=5, ge=1)
    access_request_rate_limit_window_seconds: float = Field(default=3600.0, gt=0)

    cv_max_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    cv_download_url_ttl_seconds: int = Field(default=300, gt=0)

    #: What a candidate may hand us, not what we keep: every photo is re-encoded to one
    #: small WebP before it is stored.
    avatar_max_upload_bytes: int = Field(default=5 * 1024 * 1024, gt=0)

    openai_api_key: SecretStr | None = None
    openai_cv_model: str = "gpt-4o-mini"
    openai_assessment_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_timeout_seconds: float = Field(default=120.0, gt=0)

    #: Per Tenant, not per browser: what this limit protects is the model budget, and one
    #: tenant's recruiters share the cost of every assessment they ask for.
    assessment_rate_limit_max_requests: int = Field(default=20, ge=1)
    assessment_rate_limit_window_seconds: float = Field(default=60.0, gt=0)

    resend_api_key: SecretStr | None = None
    #: Resend's sandbox sender, which needs no verified domain. Every deployment that sends
    #: to a real address overrides it with one of its own.
    email_from: str = "Sync Hub <onboarding@resend.dev>"
    email_timeout_seconds: int = Field(default=30, gt=0)

    #: Shared with the database webhook and the schedule that call the worker. Neither can
    #: mint a Google identity token, so this is what stands in for IAM.
    worker_shared_secret: SecretStr | None = None
    #: Ceiling on one invocation, so a continuously fed queue cannot keep a request alive
    #: until the platform kills it mid-job. Stopping early is safe; the schedule calls again.
    worker_drain_max_rows: int = Field(default=500, ge=1)
    worker_max_attempts: int = Field(default=3, ge=1)
    worker_retry_backoff_seconds: float = Field(default=10.0, gt=0)
    worker_stuck_job_seconds: float = Field(default=600.0, gt=0)
    worker_ingestion_concurrency: int = Field(default=4, ge=1)
    worker_embedding_concurrency: int = Field(default=2, ge=1)
    worker_communications_concurrency: int = Field(default=2, ge=1)

    log_level: LogLevel = LogLevel.INFO
    log_format: LogFormat = LogFormat.JSON

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept `a,b` as well as a JSON array, because the value is set by hand per deployment."""
        if isinstance(value, str):
            return tuple(origin.strip() for origin in value.split(",") if origin.strip())
        return value

    @field_validator("cors_allowed_origins")
    @classmethod
    def _origins_are_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for origin in value:
            if origin == "*":
                message = "cors_allowed_origins must name origins explicitly, never '*'."
                raise ValueError(message)
            parsed = urlsplit(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                message = f"{origin!r} is not an origin: expected scheme://host[:port]."
                raise ValueError(message)
            if parsed.path or parsed.query or parsed.fragment:
                message = f"{origin!r} has a path; a browser's Origin header never does."
                raise ValueError(message)
        return value

    @model_validator(mode="after")
    def _keep_session_cookies_host_only(self) -> Settings:
        """A cookie domain in a deployed environment is a cross-environment session leak.

        Refused rather than warned about: the failure it prevents is staging's cookie being
        accepted by production's API, which no test in either environment would notice.
        """
        if self.auth_cookie_domain is not None and self.environment.is_deployed:
            message = (
                "auth_cookie_domain must stay unset in deployed environments; a shared parent "
                "domain would send one environment's session cookie to the other's API."
            )
            raise ValueError(message)
        return self

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
    # Every required field is read from the environment, which no checker can see.
    return Settings()  # pyright: ignore[reportCallIssue]
