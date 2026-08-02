from __future__ import annotations

from dataclasses import replace

from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import Profile, RecruiterRole, Tenant
from tests.conftest import RECRUITER_PORTAL_URL
from tests.support.candidates import a_confirmed_candidate
from tests.support.mailbox import Mailbox
from tests.support.platform_admins import (
    a_new_tenant,
    a_signed_in_platform_admin,
    create_tenant,
    list_tenants,
    resend_invite,
    set_tenant_status,
)
from tests.support.tenants import accept_invite, an_admin, an_invitee_address, invite

EMAIL_TAKEN = "urn:sync:problem:email-already-registered"
SLUG_TAKEN = "urn:sync:problem:tenant-slug-taken"
TENANT_NOT_FOUND = "urn:sync:problem:tenant-not-found"
INVITE_ALREADY_ACCEPTED = "urn:sync:problem:invite-already-accepted"
TENANT_SUSPENDED = "urn:sync:problem:tenant-suspended"


async def test_a_platform_admin_lists_every_tenant(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    first = await an_admin(other_browser, mailbox, label="first")
    await invite(other_browser, email=an_invitee_address())
    second = await an_admin(third_browser, mailbox, label="second")
    await a_signed_in_platform_admin(app, browser, db_session)

    listed = await list_tenants(browser)

    assert listed.status_code == 200, listed.text
    rows = {row["slug"]: row for row in listed.json()}
    assert set(rows) == {first.slug, second.slug}
    assert rows[first.slug]["name"] == first.tenant_name
    assert rows[first.slug]["plan"] == "free"
    assert rows[first.slug]["member_count"] == 2
    assert rows[first.slug]["is_active"] is True
    assert rows[second.slug]["member_count"] == 1


async def test_a_platform_admin_opens_a_tenant_and_invites_its_founding_admin(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()

    opened = await create_tenant(browser, wanted)

    assert opened.status_code == 201, opened.text
    body = opened.json()
    assert body["tenant"]["name"] == wanted.name
    assert body["tenant"]["slug"] == wanted.slug
    assert body["tenant"]["member_count"] == 1
    assert body["tenant"]["is_active"] is True
    assert body["founding_admin"]["email"] == wanted.email
    assert body["founding_admin"]["full_name"] == wanted.full_name
    assert body["founding_admin"]["role"] == RecruiterRole.ADMIN.value
    assert [row["slug"] for row in (await list_tenants(browser)).json()] == [wanted.slug]


async def test_the_invitation_lands_in_the_recruiter_portal(
    app: FastAPI, browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()

    await create_tenant(browser, wanted)

    body = await mailbox.newest_body(wanted.email)
    assert f"{RECRUITER_PORTAL_URL}/auth/accept-invite" in body, body


async def test_the_founding_admin_sets_their_own_password_and_runs_the_new_tenant(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()
    await create_tenant(browser, wanted)

    accepted = await accept_invite(other_browser, mailbox, wanted.email)

    assert accepted.status_code == 200, accepted.text
    mine = await other_browser.get("/v1/tenants/me")
    assert mine.status_code == 200, mine.text
    assert mine.json()["slug"] == wanted.slug
    inviting_a_teammate = await invite(other_browser, email=an_invitee_address())
    assert inviting_a_teammate.status_code == 201, inviting_a_teammate.text


async def test_a_taken_slug_is_refused(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    taken = a_new_tenant()
    assert (await create_tenant(browser, taken)).status_code == 201

    refused = await create_tenant(browser, a_new_tenant(slug=taken.slug))

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == SLUG_TAKEN
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1


async def test_a_founding_admins_existing_account_is_refused_the_way_it_always_is(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate = await a_confirmed_candidate(other_browser, mailbox)
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = replace(a_new_tenant(), email=candidate.email)

    refused = await create_tenant(browser, wanted)

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == EMAIL_TAKEN
    assert refused.json()["detail"] == "An account already exists for this email address."
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 0
    still_a_candidate = (
        await db_session.execute(select(Profile).where(Profile.full_name == candidate.full_name))
    ).scalar_one()
    assert still_a_candidate.account_type.value == "candidate"


async def test_a_refused_tenant_never_invites_anybody(
    app: FastAPI, browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The slug is checked before the invitation goes out, so a request that cannot succeed
    puts no link in anybody's inbox and strands no identity to clean up afterwards."""
    await a_signed_in_platform_admin(app, browser, db_session)
    taken = a_new_tenant()
    await create_tenant(browser, taken)
    doomed = a_new_tenant(slug=taken.slug)

    await create_tenant(browser, doomed)

    assert await mailbox.count_for(doomed.email) == 0
    identities = await db_session.scalar(
        text("select count(*) from auth.users where email = :email").bindparams(email=doomed.email)
    )
    assert identities == 0


async def test_a_pending_invite_shows_on_the_tenant_and_can_be_resent(
    app: FastAPI, browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()
    created = await create_tenant(browser, wanted)
    assert created.json()["tenant"]["invite_pending"] is True

    resent = await resend_invite(browser, created.json()["tenant"]["id"])

    assert resent.status_code == 200, resent.text
    assert resent.json()["email"] == wanted.email
    assert await mailbox.delivered_at_least(wanted.email, 2)


async def test_a_resent_invite_still_opens_the_tenant(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()
    created = await create_tenant(browser, wanted)
    await resend_invite(browser, created.json()["tenant"]["id"])

    accepted = await accept_invite(other_browser, mailbox, wanted.email)

    assert accepted.status_code == 200, accepted.text
    assert (await other_browser.get("/v1/tenants/me")).json()["slug"] == wanted.slug


async def test_an_accepted_invite_is_not_resent(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    wanted = a_new_tenant()
    created = await create_tenant(browser, wanted)
    await accept_invite(other_browser, mailbox, wanted.email)

    refused = await resend_invite(browser, created.json()["tenant"]["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == INVITE_ALREADY_ACCEPTED
    assert [row["invite_pending"] for row in (await list_tenants(browser)).json()] == [False]


async def test_resending_for_a_tenant_that_does_not_exist_is_a_404(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    missing = await resend_invite(browser, "00000000-0000-0000-0000-000000000000")

    assert missing.status_code == 404, missing.text
    assert missing.json()["type"] == TENANT_NOT_FOUND


async def test_a_suspended_tenants_recruiters_are_refused_and_told_why(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_admin(other_browser, mailbox)
    await a_signed_in_platform_admin(app, browser, db_session)
    tenant_id = (await list_tenants(browser)).json()[0]["id"]

    suspended = await set_tenant_status(browser, tenant_id, is_active=False)

    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["is_active"] is False
    refused = await other_browser.get("/v1/tenants/me")
    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == TENANT_SUSPENDED
    assert refused.json()["detail"] == "This tenant is suspended. Contact Sync to restore it."


async def test_restoring_a_tenant_gives_its_recruiters_their_access_back(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    signup = await an_admin(other_browser, mailbox)
    await a_signed_in_platform_admin(app, browser, db_session)
    tenant_id = (await list_tenants(browser)).json()[0]["id"]
    await set_tenant_status(browser, tenant_id, is_active=False)

    restored = await set_tenant_status(browser, tenant_id, is_active=True)

    assert restored.status_code == 200, restored.text
    assert restored.json()["is_active"] is True
    mine = await other_browser.get("/v1/tenants/me")
    assert mine.status_code == 200, mine.text
    assert mine.json()["slug"] == signup.slug


async def test_suspending_a_tenant_that_does_not_exist_is_a_404(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    missing = await set_tenant_status(
        browser, "00000000-0000-0000-0000-000000000000", is_active=False
    )

    assert missing.status_code == 404, missing.text
    assert missing.json()["type"] == TENANT_NOT_FOUND
