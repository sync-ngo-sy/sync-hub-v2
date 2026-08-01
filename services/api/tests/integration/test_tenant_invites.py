from __future__ import annotations

from dataclasses import replace

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant
from tests.conftest import RECRUITER_PORTAL_URL
from tests.support.candidates import DEFAULT_PASSWORD, a_confirmed_candidate
from tests.support.mailbox import Mailbox
from tests.support.tenants import (
    a_tenant_signup,
    accept_invite,
    an_admin,
    an_invitee_address,
    invite,
    sign_up_tenant,
)


async def test_inviting_adds_the_member_before_they_accept(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()

    response = await invite(browser, email=email, full_name="Yusuf Nasser")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == email
    assert body["full_name"] == "Yusuf Nasser"
    assert body["role"] == RecruiterRole.RECRUITER.value
    assert body["is_active"] is True

    profile = (
        await db_session.execute(select(Profile).where(Profile.id == body["id"]))
    ).scalar_one()
    assert profile.account_type == AccountType.RECRUITER
    recruiter = (
        await db_session.execute(select(Recruiter).where(Recruiter.id == body["id"]))
    ).scalar_one()
    assert recruiter.role == RecruiterRole.RECRUITER
    assert recruiter.is_active


async def test_inviting_sends_the_invitation_email(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()

    await invite(browser, email=email)

    assert await mailbox.confirmation_token(email)


async def test_the_invitation_lands_in_the_recruiter_portal(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()

    await invite(browser, email=email)

    body = await mailbox.newest_body(email)
    assert f"{RECRUITER_PORTAL_URL}/auth/accept-invite" in body, body


async def test_accepting_sets_a_password_and_lands_in_the_tenant(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    admin_signup = await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)

    accepted = await accept_invite(other_browser, mailbox, email)

    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["email"] == email
    assert ACCESS_TOKEN_COOKIE in accepted.cookies

    tenant = await other_browser.get("/v1/tenants/me")
    assert tenant.status_code == 200, tenant.text
    assert tenant.json()["slug"] == admin_signup.slug


async def test_the_password_chosen_on_acceptance_is_the_one_that_signs_them_in(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)
    await accept_invite(other_browser, mailbox, email, password="a-brand-new-password")
    other_browser.cookies.clear()

    refused = await other_browser.post(
        "/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )
    accepted = await other_browser.post(
        "/v1/auth/login", json={"email": email, "password": "a-brand-new-password"}
    )

    assert refused.status_code == 401
    assert accepted.status_code == 200, accepted.text


async def test_an_invitation_can_name_the_admin_role(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()

    response = await invite(browser, email=email, role=RecruiterRole.ADMIN)

    assert response.status_code == 201, response.text
    assert response.json()["role"] == RecruiterRole.ADMIN.value
    recruiter = (
        await db_session.execute(select(Recruiter).where(Recruiter.id == response.json()["id"]))
    ).scalar_one()
    assert recruiter.role == RecruiterRole.ADMIN


async def test_inviting_a_candidates_address_is_refused_and_adds_nobody(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    candidate = await a_confirmed_candidate(other_browser, mailbox)
    await an_admin(browser, mailbox)

    response = await invite(browser, email=candidate.email)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Recruiter)) == 1
    still_a_candidate = (
        await db_session.execute(select(Profile).where(Profile.full_name == candidate.full_name))
    ).scalar_one()
    assert still_a_candidate.account_type == AccountType.CANDIDATE


async def test_inviting_someone_already_on_the_roster_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)

    response = await invite(browser, email=email)

    assert response.status_code == 409
    assert await db_session.scalar(select(func.count()).select_from(Recruiter)) == 2


async def test_an_invited_address_cannot_start_a_tenant_of_its_own(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)

    response = await sign_up_tenant(other_browser, replace(a_tenant_signup(), email=email))

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1


async def test_an_invitation_can_only_be_accepted_once(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)
    await accept_invite(other_browser, mailbox, email)

    replayed = await accept_invite(other_browser, mailbox, email)

    assert replayed.status_code == 400
    assert replayed.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_a_made_up_invitation_token_is_refused(browser: AsyncClient) -> None:
    response = await browser.post(
        "/v1/auth/accept-invite",
        json={"token_hash": "not-a-real-token", "password": DEFAULT_PASSWORD},
    )

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_an_invited_teammate_cannot_sign_in_before_accepting(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    await invite(browser, email=email)

    response = await other_browser.post(
        "/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 401
    assert (await other_browser.get("/v1/tenants/me")).status_code == 401
