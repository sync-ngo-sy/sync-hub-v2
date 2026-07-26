"""Self-serve Tenant signup and teammate invites.

Signup spans the same two authorities as candidate signup (GoTrue for the identity,
Postgres for the rest — see `test_auth_signup.py`), so the tests that matter most are again
about what a *failed* attempt leaves behind — this time also a Tenant, and a slug that must
stay usable by whoever tries next. Invite is the same shape one step earlier: the identity
and the Recruiter are both written at invite time, before anyone has proven anything.
"""

from __future__ import annotations

from dataclasses import replace
from uuid import UUID

from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant
from tests.support.candidates import a_confirmed_candidate
from tests.support.candidates import a_signup as a_candidate_signup
from tests.support.candidates import sign_up as candidate_sign_up
from tests.support.mailbox import Mailbox
from tests.support.tenants import (
    a_confirmed_tenant_admin,
    a_tenant_signup,
    accept_invite,
    confirm_tenant_admin_email,
    invite_recruiter,
    log_in_recruiter,
    sign_up_tenant,
)


async def test_tenant_signup_creates_the_tenant_profile_and_admin_recruiter(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_tenant_signup()

    response = await sign_up_tenant(browser, signup)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == signup.email
    assert body["full_name"] == signup.full_name
    assert body["account_type"] == AccountType.RECRUITER.value

    tenant = (
        await db_session.execute(select(Tenant).where(Tenant.slug == signup.tenant_slug))
    ).scalar_one()
    assert tenant.name == signup.tenant_name
    assert tenant.is_active is True

    profile = (await db_session.execute(select(Profile))).scalar_one()
    assert str(profile.id) == body["id"]
    assert profile.account_type == AccountType.RECRUITER

    recruiter = (await db_session.execute(select(Recruiter))).scalar_one()
    assert recruiter.id == profile.id
    assert recruiter.tenant_id == tenant.id
    assert recruiter.role == RecruiterRole.ADMIN
    assert recruiter.is_active is True


async def test_tenant_signup_leaves_the_identity_unconfirmed_and_starts_no_session(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_tenant_signup()

    response = await sign_up_tenant(browser, signup)

    assert ACCESS_TOKEN_COOKIE not in response.cookies
    confirmed_at = await db_session.scalar(
        text("select email_confirmed_at from auth.users where email = :email").bindparams(
            email=signup.email
        )
    )
    assert confirmed_at is None


async def test_confirming_the_admins_email_signs_them_into_their_tenant(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = a_tenant_signup()
    await sign_up_tenant(browser, signup)

    response = await confirm_tenant_admin_email(browser, mailbox, signup)

    assert response.status_code == 200, response.text
    assert response.json()["account_type"] == AccountType.RECRUITER.value
    assert ACCESS_TOKEN_COOKIE in response.cookies


async def test_tenant_signup_refuses_a_duplicate_slug(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    """The acceptance criterion: `insert tenants` fails on the unique slug, and the identity
    GoTrue already created for the second attempt is rolled back — same guarantee candidate
    signup gives when its own downstream write fails."""
    first = a_tenant_signup("acme")
    await sign_up_tenant(browser, first)
    second = a_tenant_signup("other", slug=first.tenant_slug)

    response = await sign_up_tenant(browser, second)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:tenant-slug-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1

    identities = await db_session.scalar(
        text("select count(*) from auth.users where email = :email").bindparams(email=second.email)
    )
    assert identities == 0


async def test_tenant_signup_refuses_an_address_that_is_already_registered(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_tenant_signup()
    await sign_up_tenant(browser, signup)
    second = replace(a_tenant_signup("other"), email=signup.email)

    response = await sign_up_tenant(browser, second)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1


async def test_invite_provisions_the_profile_and_recruiter_immediately(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)

    response = await invite_recruiter(browser, full_name="Nadia Youssef", role="recruiter")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["full_name"] == "Nadia Youssef"
    assert body["role"] == "recruiter"
    assert body["is_active"] is True

    recruiter = (
        await db_session.execute(select(Recruiter).where(Recruiter.id == UUID(body["id"])))
    ).scalar_one()
    profile = (
        await db_session.execute(select(Profile).where(Profile.id == UUID(body["id"])))
    ).scalar_one()
    assert profile.account_type == AccountType.RECRUITER
    assert profile.full_name == "Nadia Youssef"
    assert recruiter.role == RecruiterRole.RECRUITER
    assert recruiter.is_active is True

    assert await mailbox.confirmation_token(body["email"])


async def test_accepting_the_invite_sets_a_password_and_lands_in_the_tenant(
    browser: AsyncClient, second_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)
    await log_in_recruiter(browser, admin.email, password=admin.password)
    invited = await invite_recruiter(browser, full_name="Nadia Youssef")
    email = invited.json()["email"]

    response = await accept_invite(second_browser, mailbox, email, password="a-new-password")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == email
    assert body["account_type"] == AccountType.RECRUITER.value
    assert ACCESS_TOKEN_COOKIE in response.cookies

    # The chosen password actually works, independently of the session accept-invite gave.
    second_browser.cookies.clear()
    logged_in = await log_in_recruiter(second_browser, email, password="a-new-password")
    assert logged_in.status_code == 200, logged_in.text


async def test_inviting_an_email_that_already_belongs_to_a_candidate_fails_cleanly(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    candidate = await a_confirmed_candidate(browser, mailbox)
    admin = await a_confirmed_tenant_admin(browser, mailbox, "other")
    await log_in_recruiter(browser, admin.email, password=admin.password)

    response = await invite_recruiter(browser, email=candidate.email)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    # Only the admin's own Recruiter row exists — the invite provisioned nothing.
    assert await db_session.scalar(select(func.count()).select_from(Recruiter)) == 1


async def test_signing_up_a_candidate_with_a_recruiters_email_fails_cleanly(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin = await a_confirmed_tenant_admin(browser, mailbox)

    candidate_signup = replace(a_candidate_signup(), email=admin.email)
    response = await candidate_sign_up(browser, candidate_signup)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
