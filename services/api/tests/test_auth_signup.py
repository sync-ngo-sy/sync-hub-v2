"""Signup: one call that has to leave three records or none.

The identity lives in GoTrue and the Profile and Candidate live in Postgres, with no
transaction spanning the two — so the tests that matter most here are the ones about what
a *failed* signup leaves behind.
"""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE
from sync_core import Settings
from sync_core.models import AccountType, Candidate, Profile
from tests.support.candidates import an_account, sign_up
from tests.support.harness import spa_onto
from tests.support.mailbox import Mailbox

#: Nothing listens here. Reaching the database is the step *after* the identity exists, so
#: pointing an app at a dead port is how a test gets a signup to fail half-way.
UNREACHABLE_DATABASE = "postgresql+asyncpg://postgres:postgres@127.0.0.1:1/postgres"


async def test_signup_creates_the_profile_and_the_candidate(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    account = an_account()

    response = await sign_up(browser, account)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == account.email
    assert body["full_name"] == account.full_name
    assert body["account_type"] == AccountType.CANDIDATE.value

    profile = (await db_session.execute(select(Profile))).scalar_one()
    assert str(profile.id) == body["id"]
    assert profile.account_type == AccountType.CANDIDATE
    assert profile.full_name == account.full_name

    candidate = (await db_session.execute(select(Candidate))).scalar_one()
    assert candidate.id == profile.id


async def test_signup_leaves_the_identity_unconfirmed(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    """The address is not trusted until the candidate proves they read mail sent to it."""
    account = an_account()

    await sign_up(browser, account)

    confirmed_at = await db_session.scalar(
        text("select email_confirmed_at from auth.users where email = :email").bindparams(
            email=account.email
        )
    )
    assert confirmed_at is None


async def test_signup_sends_a_confirmation_email(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = an_account()

    await sign_up(browser, account)

    assert await mailbox.confirmation_token(account.email)


async def test_signup_starts_no_session(browser: AsyncClient) -> None:
    """201 is not a sign-in: the candidate still has to confirm before they get cookies."""
    response = await sign_up(browser, an_account())

    assert ACCESS_TOKEN_COOKIE not in response.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_signup_refuses_an_address_that_already_has_an_account(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    account = an_account()
    await sign_up(browser, account)

    response = await sign_up(browser, account)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 1


async def test_signup_refuses_a_short_password(browser: AsyncClient) -> None:
    account = an_account(password="short")

    response = await sign_up(browser, account)

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.password"]


async def test_signup_refuses_a_malformed_address(browser: AsyncClient) -> None:
    response = await browser.post(
        "/v1/auth/signup",
        json={"email": "not-an-address", "password": "correct-horse-battery", "full_name": "A"},
    )

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.email"]


async def test_a_signup_that_cannot_reach_the_database_strands_no_identity(
    settings: Settings, db_session: AsyncSession
) -> None:
    """The acceptance criterion, tested the only way that means anything: by breaking it.

    GoTrue has already created the identity by the time the Profile insert fails, so the
    flow has to go back and delete it. Were it not to, the address would be permanently
    unusable — registered in GoTrue, unknown to the platform, and refused at signup.
    """
    account = an_account()

    async with spa_onto(settings, database_url=UNREACHABLE_DATABASE) as broken:
        response = await sign_up(broken, account)

    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/problem+json")

    identities = await db_session.scalar(
        text("select count(*) from auth.users where email = :email").bindparams(email=account.email)
    )
    assert identities == 0
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 0
