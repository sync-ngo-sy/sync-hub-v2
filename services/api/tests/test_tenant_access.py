"""Who may do what inside a Tenant, and the two switches that stop them entirely.

Three questions, and every tenant-scoped route asks all three: is this caller a Recruiter,
is their own access still on, and is their Tenant still running. The last is the operator's
kill-switch, whose whole point is that it takes effect immediately and costs nothing to
undo — so it is tested by turning it off, being refused, turning it back on, and finding
everything exactly as it was.
"""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import RecruiterRole
from tests.support.candidates import a_confirmed_candidate, sign_in
from tests.support.mailbox import Mailbox
from tests.support.tenants import (
    a_teammate,
    an_admin,
    an_invitee_address,
    change_member,
    invite,
    set_tenant_active,
)

#: Every route that only an active Recruiter of a running Tenant may reach.
TENANT_SCOPED_ROUTES = ("/v1/tenants/me", "/v1/tenants/me/members")


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

    # The writes too, and for the same reason: someone deactivated must not be able to
    # reinstate themselves, which is the one change they would most want to make.
    reinstating_themselves = await change_member(other_browser, teammate["id"], is_active=True)
    assert reinstating_themselves.status_code == 403
    assert reinstating_themselves.json()["type"] == "urn:sync:problem:recruiter-deactivated"
    assert (await invite(other_browser, email=an_invitee_address())).status_code == 403


async def test_a_deactivated_recruiter_is_still_signed_in(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Deactivation revokes what they may do, not who they are.

    Their session stays valid and `/auth/me` keeps answering, which is what lets the portal
    say why the rest of it went away instead of bouncing them to a login form that works.
    """
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
    """The kill-switch: one flag, and the whole company is locked out at once.

    "Every recruiter-scoped operation", so the writes are checked as explicitly as the
    reads — a suspension that still let an admin change the roster would not be one.
    """
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
    """Without data loss, which is the whole reason the kill-switch is a flag and not a delete."""
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
    """The Candidate half of the platform, refused at the Recruiter half's door."""
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
    """Otherwise a Tenant can lock itself out of its own administration for good."""
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
    """The guard is about the Tenant keeping an admin, not about any one person keeping the role."""
    signup = await an_admin(browser, mailbox)
    await a_teammate(browser, other_browser, mailbox, role=RecruiterRole.ADMIN)
    roster = (await browser.get("/v1/tenants/me/members")).json()
    founder = next(member for member in roster if member["email"] == signup.email)

    response = await change_member(browser, founder["id"], role=RecruiterRole.RECRUITER.value)

    assert response.status_code == 200, response.text
    assert response.json()["role"] == RecruiterRole.RECRUITER.value
    assert (await invite(browser, email=an_invitee_address())).status_code == 403


async def test_an_admin_cannot_change_another_tenants_member(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Answered as though the member did not exist: a roster is not a thing to probe."""
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
