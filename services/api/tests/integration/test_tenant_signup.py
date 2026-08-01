from __future__ import annotations

from dataclasses import replace

from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant
from tests.support.mailbox import Mailbox
from tests.support.tenants import a_tenant_signup, sign_up_tenant


async def test_signup_creates_the_tenant_and_its_admin(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_tenant_signup()

    response = await sign_up_tenant(browser, signup)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["tenant"]["name"] == signup.tenant_name
    assert body["tenant"]["slug"] == signup.slug
    assert body["admin"]["email"] == signup.email
    assert body["admin"]["full_name"] == signup.full_name
    assert body["admin"]["role"] == RecruiterRole.ADMIN.value

    tenant = (await db_session.execute(select(Tenant))).scalar_one()
    assert str(tenant.id) == body["tenant"]["id"]
    assert tenant.is_active

    profile = (await db_session.execute(select(Profile))).scalar_one()
    assert str(profile.id) == body["admin"]["id"]
    assert profile.account_type == AccountType.RECRUITER
    assert profile.full_name == signup.full_name

    recruiter = (await db_session.execute(select(Recruiter))).scalar_one()
    assert recruiter.id == profile.id
    assert recruiter.tenant_id == tenant.id
    assert recruiter.role == RecruiterRole.ADMIN
    assert recruiter.is_active


async def test_signup_starts_no_session(browser: AsyncClient) -> None:
    response = await sign_up_tenant(browser, a_tenant_signup())

    assert ACCESS_TOKEN_COOKIE not in response.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_signup_sends_a_confirmation_email(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = a_tenant_signup()

    await sign_up_tenant(browser, signup)

    assert await mailbox.confirmation_token(signup.email)


async def test_the_confirmed_admin_can_sign_in_and_reach_their_tenant(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = a_tenant_signup()
    await sign_up_tenant(browser, signup)

    token_hash = await mailbox.confirmation_token(signup.email)
    confirmed = await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})

    assert confirmed.status_code == 200, confirmed.text
    tenant = await browser.get("/v1/tenants/me")
    assert tenant.status_code == 200, tenant.text
    assert tenant.json()["slug"] == signup.slug


async def test_a_taken_slug_is_refused_and_strands_no_identity(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    taken = a_tenant_signup()
    await sign_up_tenant(browser, taken)
    second = a_tenant_signup(slug=taken.slug)

    response = await sign_up_tenant(browser, second)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:tenant-slug-taken"
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 1
    identities = await db_session.scalar(
        text("select count(*) from auth.users where email = :email").bindparams(email=second.email)
    )
    assert identities == 0


async def test_an_address_that_is_already_registered_is_refused(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    first = a_tenant_signup()
    await sign_up_tenant(browser, first)

    response = await sign_up_tenant(browser, replace(a_tenant_signup(), email=first.email))

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 1


async def test_signup_refuses_a_malformed_slug(browser: AsyncClient) -> None:
    response = await sign_up_tenant(browser, a_tenant_signup(slug="Not A Slug"))

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.slug"]


async def test_signup_refuses_a_short_password(browser: AsyncClient) -> None:
    signup = a_tenant_signup()
    response = await browser.post(
        "/v1/tenants",
        json={
            "tenant_name": signup.tenant_name,
            "slug": signup.slug,
            "email": signup.email,
            "password": "short",
            "full_name": signup.full_name,
        },
    )

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.password"]
