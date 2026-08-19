from __future__ import annotations

import pytest
from pydantic import SecretStr, ValidationError

from sync_api.portals import Portals
from sync_core import Settings
from sync_core.models import AccountType

REQUIRED = {
    "database_url": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "supabase_url": "http://127.0.0.1:54321",
    "supabase_service_role_key": SecretStr("service-role"),
    "supabase_anon_key": SecretStr("anon"),
    "candidate_portal_url": "https://jobs.sync.ngo",
    "recruiter_portal_url": "https://app.sync.ngo",
    "admin_portal_url": "https://admin.sync.ngo",
}


def settings_with(**overrides: object) -> Settings:
    return Settings(_env_file=None, **{**REQUIRED, **overrides})  # pyright: ignore[reportCallIssue, reportArgumentType]


def settings_without(name: str) -> Settings:
    return Settings(_env_file=None, **{k: v for k, v in REQUIRED.items() if k != name})  # pyright: ignore[reportCallIssue, reportArgumentType]


@pytest.mark.parametrize(
    ("account_type", "expected"),
    [
        (AccountType.CANDIDATE, "https://jobs.sync.ngo"),
        (AccountType.RECRUITER, "https://app.sync.ngo"),
        (AccountType.PLATFORM_ADMIN, "https://admin.sync.ngo"),
    ],
)
def test_each_account_type_resolves_to_the_portal_that_serves_it(
    account_type: AccountType, expected: str
) -> None:
    assert Portals.of(settings_with()).url_for(account_type) == expected


def test_every_account_type_has_a_portal() -> None:
    """A kind of Profile with no portal would redirect somebody to nowhere."""
    portals = Portals.of(settings_with())

    assert {portals.url_for(account_type) for account_type in AccountType} == {
        "https://jobs.sync.ngo",
        "https://app.sync.ngo",
        "https://admin.sync.ngo",
    }


def test_a_trailing_slash_is_trimmed_because_a_path_is_appended_to_this() -> None:
    resolved = Portals.of(settings_with(recruiter_portal_url="https://app.sync.ngo/")).url_for(
        AccountType.RECRUITER
    )

    assert resolved == "https://app.sync.ngo"


@pytest.mark.parametrize(
    "name", ["candidate_portal_url", "recruiter_portal_url", "admin_portal_url"]
)
def test_a_missing_portal_refuses_to_start(name: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Refused at import rather than at the first redirect, which is how the first staging
    revision found out it was missing two of these.

    The variable leaves the environment too. `_env_file=None` only rules out the file:
    pydantic-settings still reads `SYNC_*` from the shell, so on a machine that exports these
    — every CI runner does — the omitted field would be supplied and nothing would raise.
    """
    monkeypatch.delenv(f"SYNC_{name.upper()}", raising=False)
    with pytest.raises(ValidationError):
        settings_without(name)


@pytest.mark.parametrize(
    "url",
    [
        pytest.param("jobs.sync.ngo", id="no scheme"),
        pytest.param("ftp://jobs.sync.ngo", id="wrong scheme"),
    ],
)
def test_a_portal_that_is_not_an_absolute_http_url_is_refused(url: str) -> None:
    with pytest.raises(ValidationError):
        settings_with(candidate_portal_url=url)
