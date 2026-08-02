from __future__ import annotations

from typing import Any, Final

import pytest
from httpx import AsyncClient

from tests.support.candidates import a_signed_in_candidate
from tests.support.mailbox import Mailbox
from tests.support.platform_admins import (
    OVERVIEW,
    TENANTS,
    a_new_tenant,
    a_new_tenant_body,
)
from tests.support.tenants import a_teammate, an_admin

PLATFORM_ADMIN_ONLY: Final = "urn:sync:problem:platform-admin-only"

SOME_TENANT: Final = "00000000-0000-0000-0000-000000000000"

#: Every operation this ticket adds, with a body that would otherwise be accepted — so a refusal
#: here is the guard talking, not validation.
OPERATIONS: Final[tuple[tuple[str, str, dict[str, Any] | None], ...]] = (
    ("GET", TENANTS, None),
    ("POST", TENANTS, a_new_tenant_body(a_new_tenant())),
    ("POST", f"{TENANTS}/{SOME_TENANT}/invite", None),
    ("PATCH", f"{TENANTS}/{SOME_TENANT}", {"is_active": False}),
    ("GET", OVERVIEW, None),
)

OPERATION_IDS: Final = ("list", "create", "resend-invite", "set-status", "overview")


@pytest.mark.parametrize(("method", "path", "body"), OPERATIONS, ids=OPERATION_IDS)
async def test_a_recruiter_is_refused_every_platform_operation(
    browser: AsyncClient, mailbox: Mailbox, method: str, path: str, body: dict[str, Any] | None
) -> None:
    await an_admin(browser, mailbox)

    refused = await browser.request(method, path, json=body)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY


@pytest.mark.parametrize(("method", "path", "body"), OPERATIONS, ids=OPERATION_IDS)
async def test_a_candidate_is_refused_every_platform_operation(
    browser: AsyncClient, mailbox: Mailbox, method: str, path: str, body: dict[str, Any] | None
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.request(method, path, json=body)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY


@pytest.mark.parametrize(("method", "path", "body"), OPERATIONS, ids=OPERATION_IDS)
async def test_nobody_at_all_is_refused_every_platform_operation(
    browser: AsyncClient, method: str, path: str, body: dict[str, Any] | None
) -> None:
    refused = await browser.request(method, path, json=body)

    assert refused.status_code == 401, refused.text


async def test_a_recruiter_without_the_admin_role_is_refused_too(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The guard reads the account type, not the tenant role — so the plainest recruiter there
    is meets the same refusal their admin does."""
    await an_admin(browser, mailbox)
    await a_teammate(browser, other_browser, mailbox)

    refused = await other_browser.get(TENANTS)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY
