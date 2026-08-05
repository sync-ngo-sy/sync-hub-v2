from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE
from sync_core import Settings
from sync_core.models import AccountType, Candidate, Profile
from tests.conftest import CANDIDATE_PORTAL_URL
from tests.support.candidates import Signup, a_signup, sign_up
from tests.support.harness import spa_onto
from tests.support.mailbox import Mailbox

UNREACHABLE_DATABASE = "postgresql+asyncpg://postgres:postgres@127.0.0.1:1/postgres"


async def test_signup_creates_the_profile_and_the_candidate(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_signup()

    response = await sign_up(browser, signup)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == signup.email
    assert body["full_name"] == signup.full_name
    assert body["account_type"] == AccountType.CANDIDATE.value

    profile = (await db_session.execute(select(Profile))).scalar_one()
    assert str(profile.id) == body["id"]
    assert profile.account_type == AccountType.CANDIDATE
    assert profile.full_name == signup.full_name

    candidate = (await db_session.execute(select(Candidate))).scalar_one()
    assert candidate.id == profile.id


async def test_signup_leaves_the_identity_unconfirmed(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_signup()

    await sign_up(browser, signup)

    confirmed_at = await db_session.scalar(
        text("select email_confirmed_at from auth.users where email = :email").bindparams(
            email=signup.email
        )
    )
    assert confirmed_at is None


async def test_signup_sends_a_confirmation_email(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = a_signup()

    await sign_up(browser, signup)

    assert await mailbox.confirmation_token(signup.email)
    body = await mailbox.newest_body(signup.email)
    assert f"{CANDIDATE_PORTAL_URL}/auth/confirm" in body, body


async def test_signup_starts_no_session(browser: AsyncClient) -> None:
    response = await sign_up(browser, a_signup())

    assert ACCESS_TOKEN_COOKIE not in response.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_signup_refuses_an_address_that_is_already_registered(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = a_signup()
    await sign_up(browser, signup)

    response = await sign_up(browser, signup)

    assert response.status_code == 409
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 1


async def test_the_identity_provider_stores_every_address_lowercased(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    """The invariant `sync_api.auth.identities.by_address` rests on, held to rather than assumed.

    That lookup matches `auth.users.email` exactly, because the one index there is on the plain
    column and wrapping it in `lower()` made every signup and every password reset scan the whole
    user table. Exact only finds a mixed-case address if nothing stores one — so if GoTrue ever
    stops normalizing, this fails here rather than as a signup that lets an address through twice.
    """
    signup = a_signup()
    mixed = signup.email.upper()
    await sign_up(browser, Signup(email=mixed, password=signup.password, full_name="Amina"))

    stored = await db_session.scalar(text("select email from auth.users"))

    assert stored == mixed.lower()


async def test_signup_refuses_an_address_that_is_already_registered_in_another_case(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    """One address is one account, whatever case it is typed in — the second ask has to be the
    same 409, which is what makes the exact-match lookup safe."""
    signup = a_signup()
    await sign_up(browser, signup)

    response = await sign_up(
        browser,
        Signup(email=signup.email.upper(), password=signup.password, full_name=signup.full_name),
    )

    assert response.status_code == 409, response.text
    assert response.json()["type"] == "urn:sync:problem:email-already-registered"
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 1


async def test_signup_refuses_a_short_password(browser: AsyncClient) -> None:
    signup = a_signup(password="short")

    response = await sign_up(browser, signup)

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
    signup = a_signup()

    async with spa_onto(settings, database_url=UNREACHABLE_DATABASE) as broken:
        response = await sign_up(broken, signup)

    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/problem+json")

    identities = await db_session.scalar(
        text("select count(*) from auth.users where email = :email").bindparams(email=signup.email)
    )
    assert identities == 0
    assert await db_session.scalar(select(func.count()).select_from(Profile)) == 0
