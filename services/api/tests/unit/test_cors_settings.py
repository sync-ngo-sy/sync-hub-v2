from __future__ import annotations

import pytest
from pydantic import SecretStr, ValidationError

from sync_core import Settings
from sync_core.settings import Environment

REQUIRED = {
    "database_url": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "supabase_url": "http://127.0.0.1:54321",
    "supabase_service_role_key": SecretStr("service-role"),
    "supabase_anon_key": SecretStr("anon"),
    "recruiter_portal_url": "http://127.0.0.1:5174",
    "admin_portal_url": "http://127.0.0.1:5175",
}


def settings_with(**overrides: object) -> Settings:
    return Settings(_env_file=None, **REQUIRED, **overrides)  # pyright: ignore[reportCallIssue, reportArgumentType]


def test_origins_default_to_none_so_nothing_is_allowed_by_accident() -> None:
    assert settings_with().cors_allowed_origins == ()


def test_a_comma_separated_list_is_accepted_because_it_is_set_by_hand() -> None:
    origins = settings_with(
        cors_allowed_origins="https://jobs.sync.ngo, https://app.sync.ngo"
    ).cors_allowed_origins

    assert origins == ("https://jobs.sync.ngo", "https://app.sync.ngo")


def test_a_comma_separated_list_is_accepted_from_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The path a deployed service actually takes, which the test above does not reach.

    Passing the value as a keyword argument goes through the init source and never decodes.
    A real deployment sets an environment variable, and pydantic-settings JSON-decodes a
    complex type there before any validator runs -- so this passed everywhere and still
    killed the first Cloud Run revision at import.
    """
    for field, value in REQUIRED.items():
        raw = value.get_secret_value() if isinstance(value, SecretStr) else value
        monkeypatch.setenv(f"SYNC_{field.upper()}", str(raw))
    monkeypatch.setenv("SYNC_CORS_ALLOWED_ORIGINS", "https://jobs.sync.ngo, https://app.sync.ngo")

    settings = Settings(_env_file=None)  # pyright: ignore[reportCallIssue]

    assert settings.cors_allowed_origins == ("https://jobs.sync.ngo", "https://app.sync.ngo")


def test_a_wildcard_is_refused() -> None:
    with pytest.raises(ValidationError, match="never '\\*'"):
        settings_with(cors_allowed_origins="*")


@pytest.mark.parametrize(
    "origin",
    [
        pytest.param("jobs.sync.ngo", id="no scheme"),
        pytest.param("ftp://jobs.sync.ngo", id="wrong scheme"),
        pytest.param("https://", id="no host"),
    ],
)
def test_something_that_is_not_an_origin_is_refused(origin: str) -> None:
    with pytest.raises(ValidationError):
        settings_with(cors_allowed_origins=origin)


def test_a_trailing_slash_is_refused_because_the_comparison_is_literal() -> None:
    """A browser's Origin header has no path, so "https://x/" would match nothing."""
    with pytest.raises(ValidationError, match="has a path"):
        settings_with(cors_allowed_origins="https://jobs.sync.ngo/")


def test_the_session_cookie_is_host_only_by_default() -> None:
    assert settings_with().auth_cookie_domain is None


@pytest.mark.parametrize("environment", [Environment.STAGING, Environment.PRODUCTION])
def test_a_cookie_domain_is_refused_in_a_deployed_environment(environment: Environment) -> None:
    """The leak this prevents: staging's session cookie reaching production's API.

    Staging is the half that would do the leaking, so covering only production would leave the
    rule pointing away from the environment it exists for.
    """
    with pytest.raises(ValidationError, match="must stay unset"):
        settings_with(environment=environment, auth_cookie_domain=".sync.ngo")


def test_a_cookie_domain_is_still_allowed_locally() -> None:
    local = settings_with(environment=Environment.LOCAL, auth_cookie_domain="localhost")

    assert local.auth_cookie_domain == "localhost"
