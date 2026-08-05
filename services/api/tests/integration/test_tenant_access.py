from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.problems import LAST_TENANT_ADMIN_PROBLEM_TYPE, Problem
from sync_api.tenants import TenantService
from sync_core.models import Recruiter, RecruiterRole
from tests.conftest import RECRUITER_PORTAL_URL
from tests.support.candidates import a_confirmed_candidate, sign_in
from tests.support.harness import app_of
from tests.support.mailbox import Mailbox
from tests.support.tenants import (
    a_teammate,
    an_admin,
    an_invitee_address,
    change_member,
    invite,
    set_tenant_active,
)

if TYPE_CHECKING:
    from fastapi import FastAPI

    from sync_api.tenants import Member
    from sync_core import Database

TENANT_SCOPED_ROUTES = ("/v1/tenants/me", "/v1/tenants/me/members")

#: Long enough for a removal to reach its check against a local database, which takes a handful
#: of round trips. With the admin set locked it is still waiting when this elapses.
LONG_ENOUGH_TO_REACH_THE_CHECK = 0.5


async def test_any_recruiter_can_read_the_tenant_and_its_roster(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)

    tenant = await other_browser.get("/v1/tenants/me")
    members = await other_browser.get("/v1/tenants/me/members")

    assert tenant.status_code == 200, tenant.text
    assert tenant.json()["slug"] == signup.slug
    assert members.status_code == 200, members.text
    assert {member["email"] for member in members.json()} == {signup.email, teammate["email"]}


async def test_only_an_admin_can_invite(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_teammate(browser, other_browser, mailbox)

    response = await invite(other_browser, email=an_invitee_address())

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:tenant-admin-only"


async def test_only_an_admin_can_change_a_member(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)

    promoting_themselves = await change_member(
        other_browser, teammate["id"], role=RecruiterRole.ADMIN.value
    )

    assert promoting_themselves.status_code == 403
    assert promoting_themselves.json()["type"] == "urn:sync:problem:tenant-admin-only"


async def test_an_admin_can_promote_and_demote(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)

    promoted = await change_member(browser, teammate["id"], role=RecruiterRole.ADMIN.value)
    can_now_invite = await invite(other_browser, email=an_invitee_address())
    demoted = await change_member(browser, teammate["id"], role=RecruiterRole.RECRUITER.value)
    can_no_longer_invite = await invite(other_browser, email=an_invitee_address())

    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["role"] == RecruiterRole.ADMIN.value
    assert can_now_invite.status_code == 201, can_now_invite.text
    assert demoted.json()["role"] == RecruiterRole.RECRUITER.value
    assert can_no_longer_invite.status_code == 403


async def test_a_deactivated_recruiter_is_refused_at_every_tenant_route(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)

    deactivated = await change_member(browser, teammate["id"], is_active=False)

    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False
    for route in TENANT_SCOPED_ROUTES:
        refused = await other_browser.get(route)
        assert refused.status_code == 403, f"{route} answered {refused.status_code}"
        assert refused.json()["type"] == "urn:sync:problem:recruiter-deactivated"

    reinstating_themselves = await change_member(other_browser, teammate["id"], is_active=True)
    assert reinstating_themselves.status_code == 403
    assert reinstating_themselves.json()["type"] == "urn:sync:problem:recruiter-deactivated"
    assert (await invite(other_browser, email=an_invitee_address())).status_code == 403


async def test_a_deactivated_recruiter_is_still_signed_in(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)
    await change_member(browser, teammate["id"], is_active=False)

    response = await other_browser.get("/v1/auth/me")

    assert response.status_code == 200, response.text
    assert response.json()["email"] == teammate["email"]


async def test_reactivating_a_recruiter_restores_their_access(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)
    await change_member(browser, teammate["id"], is_active=False)

    reinstated = await change_member(browser, teammate["id"], is_active=True)

    assert reinstated.json()["is_active"] is True
    assert (await other_browser.get("/v1/tenants/me")).status_code == 200


async def test_suspending_the_tenant_refuses_everyone_including_admins(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    signup = await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)

    await set_tenant_active(db_session, signup.slug, is_active=False)

    for actor in (browser, other_browser):
        for route in TENANT_SCOPED_ROUTES:
            refused = await actor.get(route)
            assert refused.status_code == 403, f"{route} answered {refused.status_code}"
            assert refused.json()["type"] == "urn:sync:problem:tenant-suspended"

    for refused_write in (
        await invite(browser, email=an_invitee_address()),
        await change_member(browser, teammate["id"], is_active=False),
    ):
        assert refused_write.status_code == 403
        assert refused_write.json()["type"] == "urn:sync:problem:tenant-suspended"


async def test_reactivating_the_tenant_restores_access_unchanged(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    signup = await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)
    before = (await browser.get("/v1/tenants/me/members")).json()

    await set_tenant_active(db_session, signup.slug, is_active=False)
    await set_tenant_active(db_session, signup.slug, is_active=True)

    assert (await browser.get("/v1/tenants/me/members")).json() == before
    assert (await other_browser.get("/v1/tenants/me")).json()["slug"] == signup.slug
    assert (await invite(browser, email=an_invitee_address())).status_code == 201
    assert teammate["id"] in {member["id"] for member in before}


async def test_a_candidate_is_refused_at_every_tenant_route(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    candidate = await a_confirmed_candidate(browser, mailbox)
    signed_in = await sign_in(browser, candidate)
    assert signed_in.status_code == 200, signed_in.text

    for route in TENANT_SCOPED_ROUTES:
        refused = await browser.get(route)
        assert refused.status_code == 403, f"{route} answered {refused.status_code}"
        assert refused.json()["type"] == "urn:sync:problem:recruiter-only"


async def test_a_stranger_is_refused_at_every_tenant_route(browser: AsyncClient) -> None:
    for route in TENANT_SCOPED_ROUTES:
        refused = await browser.get(route)
        assert refused.status_code == 401, f"{route} answered {refused.status_code}"


async def test_the_last_active_admin_cannot_be_demoted(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    me = (await browser.get("/v1/tenants/me/members")).json()[0]

    response = await change_member(browser, me["id"], role=RecruiterRole.RECRUITER.value)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:last-tenant-admin"
    assert (await browser.get("/v1/tenants/me/members")).json()[0]["role"] == (
        RecruiterRole.ADMIN.value
    )


async def test_the_last_active_admin_cannot_be_deactivated(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    me = (await browser.get("/v1/tenants/me/members")).json()[0]

    response = await change_member(browser, me["id"], is_active=False)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:last-tenant-admin"
    assert (await browser.get("/v1/tenants/me")).status_code == 200


async def test_an_admin_may_step_down_once_someone_else_can_run_the_tenant(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await an_admin(browser, mailbox)
    await a_teammate(browser, other_browser, mailbox, role=RecruiterRole.ADMIN)
    roster = (await browser.get("/v1/tenants/me/members")).json()
    founder = next(member for member in roster if member["email"] == signup.email)

    response = await change_member(browser, founder["id"], role=RecruiterRole.RECRUITER.value)

    assert response.status_code == 200, response.text
    assert response.json()["role"] == RecruiterRole.RECRUITER.value
    assert (await invite(browser, email=an_invitee_address())).status_code == 403


async def test_an_admin_cannot_be_removed_while_the_other_one_is_being_removed(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    """Two removals at once, each reading a roster the other is halfway through changing.

    A Tenant left with no active admin cannot be repaired from its own side — every route that
    could appoint one needs an active admin to call it — and the platform has no operation that
    reaches into a Tenant's roster either. So this is the one place the check has to hold under
    concurrency, and holding a lock on the row being changed is not enough to make it.

    Driven below HTTP because what has to overlap is the transactions, not the requests.
    """
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox, role=RecruiterRole.ADMIN)
    roster = (await browser.get("/v1/tenants/me/members")).json()
    tenant_id = UUID((await browser.get("/v1/tenants/me")).json()["id"])
    founder = next(member for member in roster if member["id"] != teammate["id"])

    async with database.session() as in_flight:
        # The other admin's removal, mid-transaction: changed, locked, and invisible to anyone
        # who has not asked to wait for it.
        await in_flight.execute(
            update(Recruiter).where(Recruiter.id == UUID(teammate["id"])).values(is_active=False)
        )
        removing = asyncio.create_task(
            _deactivate(database, app_of(browser), tenant_id, UUID(founder["id"]))
        )
        await asyncio.wait([removing], timeout=LONG_ENOUGH_TO_REACH_THE_CHECK)
        await in_flight.commit()

    with pytest.raises(Problem) as refused:
        await removing

    assert refused.value.type == LAST_TENANT_ADMIN_PROBLEM_TYPE
    assert await _active_admins(db_session, tenant_id) == 1


async def _deactivate(
    database: Database, app: FastAPI, tenant_id: UUID, recruiter_id: UUID
) -> Member:
    async with database.session() as session:
        tenants = TenantService(
            session,
            app.state.authentication.gotrue,
            recruiter_portal_url=RECRUITER_PORTAL_URL,
        )
        return await tenants.change_member(
            tenant_id=tenant_id, recruiter_id=recruiter_id, is_active=False
        )


async def _active_admins(session: AsyncSession, tenant_id: UUID) -> int:
    total = await session.scalar(
        select(func.count())
        .select_from(Recruiter)
        .where(
            Recruiter.tenant_id == tenant_id,
            Recruiter.role == RecruiterRole.ADMIN,
            Recruiter.is_active.is_(True),
        )
    )
    return int(total or 0)


async def test_an_admin_cannot_change_another_tenants_member(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox, label="first")
    await an_admin(other_browser, mailbox, label="second")
    theirs = (await other_browser.get("/v1/tenants/me/members")).json()[0]

    response = await change_member(browser, theirs["id"], is_active=False)

    assert response.status_code == 404
    assert response.json()["type"] == "urn:sync:problem:member-not-found"
    assert (await other_browser.get("/v1/tenants/me")).status_code == 200


async def test_changing_a_member_that_does_not_exist_is_a_404(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    response = await change_member(browser, "00000000-0000-0000-0000-000000000000", is_active=False)

    assert response.status_code == 404
