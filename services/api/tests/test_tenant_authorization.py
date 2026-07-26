"""Who gets to act on a Tenant: admin-only actions, and the two off switches — a deactivated
Recruiter, and a Tenant paused by the operator kill-switch.

`ActingRecruiterDep` is the single gate every route in `routes/tenants.py` depends on (see
`sync_api.tenants.service`), so these tests exercise it through those routes rather than by
calling `TenantService` directly — the same "drive the HTTP boundary" convention the rest of
the suite follows.
"""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import Recruiter, RecruiterRole, Tenant
from tests.support.candidates import a_confirmed_candidate
from tests.support.candidates import sign_in as candidate_sign_in
from tests.support.mailbox import Mailbox
from tests.support.tenants import (
    a_confirmed_tenant_admin,
    an_accepted_teammate,
    invite_recruiter,
    log_in_recruiter,
)


async def test_a_candidate_cannot_reach_a_tenant_scoped_route(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    candidate = await a_confirmed_candidate(browser, mailbox)
    signed_in = await candidate_sign_in(browser, candidate)
    assert signed_in.status_code == 200, signed_in.text

    response = await invite_recruiter(browser)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:recruiter-only"


async def test_an_unauthenticated_caller_cannot_reach_a_tenant_scoped_route(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/v1/tenants/recruiters",
        json={"email": "nobody@example.com", "full_name": "Nobody"},
        headers={"X-Sync-Request": "1"},
    )

    assert response.status_code == 401


async def test_a_non_admin_recruiter_cannot_invite(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    await an_accepted_teammate(browser, second_browser, mailbox, role="recruiter")

    response = await invite_recruiter(second_browser)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:admin-role-required"


async def test_a_non_admin_recruiter_cannot_change_roles_or_deactivate(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    recruiter_id, _ = await an_accepted_teammate(browser, second_browser, mailbox, role="recruiter")

    response = await second_browser.patch(
        f"/v1/tenants/recruiters/{recruiter_id}", json={"is_active": False}
    )

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:admin-role-required"


async def test_an_admin_can_change_a_teammates_role_and_deactivate_them(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    recruiter_id, _ = await an_accepted_teammate(browser, second_browser, mailbox, role="recruiter")

    response = await browser.patch(
        f"/v1/tenants/recruiters/{recruiter_id}", json={"role": "admin", "is_active": False}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["role"] == "admin"
    assert body["is_active"] is False


async def test_updating_a_recruiter_outside_the_callers_tenant_is_not_found(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin_a = await a_confirmed_tenant_admin(browser, mailbox, "acme")
    await log_in_recruiter(browser, admin_a.email, password=admin_a.password)
    admin_b = await a_confirmed_tenant_admin(second_browser, mailbox, "globex")
    await log_in_recruiter(second_browser, admin_b.email, password=admin_b.password)

    profile = await second_browser.get("/v1/auth/me")
    response = await browser.patch(
        f"/v1/tenants/recruiters/{profile.json()['id']}", json={"is_active": False}
    )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:sync:problem:recruiter-not-found"


async def test_listing_recruiters_returns_only_the_callers_own_tenant(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    await an_accepted_teammate(browser, second_browser, mailbox, role="recruiter")

    response = await browser.get("/v1/tenants/recruiters")

    assert response.status_code == 200, response.text
    emails = {recruiter["email"] for recruiter in response.json()}
    assert emails == {admin.email, (await second_browser.get("/v1/auth/me")).json()["email"]}


async def test_an_admin_cannot_deactivate_the_tenants_last_active_admin(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    profile = (await browser.get("/v1/auth/me")).json()

    response = await browser.patch(
        f"/v1/tenants/recruiters/{profile['id']}", json={"is_active": False}
    )

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:tenant-requires-an-admin"


async def test_an_admin_cannot_demote_the_tenants_last_active_admin(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    profile = (await browser.get("/v1/auth/me")).json()

    response = await browser.patch(
        f"/v1/tenants/recruiters/{profile['id']}", json={"role": "recruiter"}
    )

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:tenant-requires-an-admin"


async def test_deactivating_an_admin_is_allowed_once_another_admin_exists(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    await an_accepted_teammate(browser, second_browser, mailbox, role="admin")
    profile = (await browser.get("/v1/auth/me")).json()

    response = await browser.patch(
        f"/v1/tenants/recruiters/{profile['id']}", json={"is_active": False}
    )

    assert response.status_code == 200, response.text
    # The teammate promoted to admin can still act — the Tenant kept an active admin.
    still_works = await invite_recruiter(second_browser)
    assert still_works.status_code == 201, still_works.text


async def test_a_deactivated_recruiter_gets_403_on_tenant_scoped_routes(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Deactivation blocks even an admin — it is checked before the admin-role requirement,
    not instead of it."""
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    recruiter_id, _ = await an_accepted_teammate(browser, second_browser, mailbox, role="admin")
    deactivated = await browser.patch(
        f"/v1/tenants/recruiters/{recruiter_id}", json={"is_active": False}
    )
    assert deactivated.status_code == 200, deactivated.text

    response = await invite_recruiter(second_browser)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:recruiter-inactive"


async def test_tenant_kill_switch_blocks_every_recruiter_scoped_operation(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    tenant = (
        await db_session.execute(select(Tenant).where(Tenant.slug == admin.tenant_slug))
    ).scalar_one()

    tenant.is_active = False
    await db_session.commit()

    response = await invite_recruiter(browser)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:tenant-inactive"


async def test_reactivating_the_tenant_restores_access_unchanged(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    tenant = (
        await db_session.execute(select(Tenant).where(Tenant.slug == admin.tenant_slug))
    ).scalar_one()
    tenant.is_active = False
    await db_session.commit()
    assert (await invite_recruiter(browser)).status_code == 403

    tenant.is_active = True
    await db_session.commit()

    response = await invite_recruiter(browser, full_name="Post Reactivation")

    assert response.status_code == 201, response.text
    admin_row = (
        await db_session.execute(
            select(Recruiter).where(
                Recruiter.tenant_id == tenant.id, Recruiter.role == RecruiterRole.ADMIN
            )
        )
    ).scalar_one()
    assert admin_row.is_active is True
