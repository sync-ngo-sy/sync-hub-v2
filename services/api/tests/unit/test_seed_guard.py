"""The seed invents people. This is the only thing standing between them and real users."""

from __future__ import annotations

import pytest
from pydantic import SecretStr
from seed_demo import refuse_a_real_environment

from sync_core import Settings
from sync_core.settings import Environment

REQUIRED = {
    "database_url": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "supabase_service_role_key": SecretStr("service-role"),
    "supabase_anon_key": SecretStr("anon"),
    "recruiter_portal_url": "http://127.0.0.1:5174",
    "admin_portal_url": "http://127.0.0.1:5175",
}


def settings_for(environment: Environment, supabase_url: str) -> Settings:
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        environment=environment,
        supabase_url=supabase_url,
        **REQUIRED,
    )


def test_a_local_stack_is_seedable() -> None:
    refuse_a_real_environment(settings_for(Environment.LOCAL, "http://127.0.0.1:54321"))


def test_staging_is_seedable_even_though_it_is_a_deployed_environment() -> None:
    """Staging exists to be filled with invented data and torn down again."""
    refuse_a_real_environment(
        settings_for(Environment.STAGING, "https://qjsqmtemyhvtnurohckb.supabase.co")
    )


def test_production_is_refused() -> None:
    with pytest.raises(SystemExit, match="this is production"):
        refuse_a_real_environment(
            settings_for(Environment.PRODUCTION, "https://skmsobeqyljduzkjmokr.supabase.co")
        )


def test_production_is_refused_even_when_pointed_at_a_local_host() -> None:
    """The environment decides, not the address. A tunnel or a proxy must not open the door."""
    with pytest.raises(SystemExit, match="this is production"):
        refuse_a_real_environment(settings_for(Environment.PRODUCTION, "http://127.0.0.1:54321"))


def test_a_local_environment_pointed_somewhere_else_is_refused() -> None:
    """Says local, is not local. Guessing which half is wrong is not the script's job."""
    with pytest.raises(SystemExit, match="the host is not"):
        refuse_a_real_environment(
            settings_for(Environment.LOCAL, "https://qjsqmtemyhvtnurohckb.supabase.co")
        )


def test_ci_is_refused_because_only_local_and_staging_are_seedable() -> None:
    with pytest.raises(SystemExit, match="Only local and staging"):
        refuse_a_real_environment(settings_for(Environment.CI, "https://example.supabase.co"))
