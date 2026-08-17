from __future__ import annotations

import datetime as dt

import pytest
from httpx import AsyncClient
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import SESSION_COOKIE, pack_session
from sync_core import Settings
from sync_core.models import Profile
from tests.support.candidates import (
    a_confirmed_candidate,
    a_signup,
    confirm_email,
    sign_in,
    sign_up,
)
from tests.support.harness import cookie_attributes, present_only, session_tokens, spa_onto
from tests.support.mailbox import Mailbox

UNREACHABLE_GOTRUE = "http://127.0.0.1:1"


async def test_signing_in_before_confirming_is_refused(browser: AsyncClient) -> None:
    signup = a_signup()
    await sign_up(browser, signup)

    response = await sign_in(browser, signup)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:email-not-confirmed"
    assert SESSION_COOKIE not in browser.cookies


async def test_confirming_the_address_signs_the_candidate_in(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    signup = a_signup()
    await sign_up(browser, signup)

    response = await confirm_email(browser, mailbox, signup)

    assert response.status_code == 200, response.text
    assert response.json()["email"] == signup.email

    confirmed_at = await db_session.scalar(
        text("select email_confirmed_at from auth.users where email = :email").bindparams(
            email=signup.email
        )
    )
    assert confirmed_at is not None

    me = await browser.get("/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == signup.email


async def test_a_confirmation_link_works_only_once(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = a_signup()
    await sign_up(browser, signup)
    await confirm_email(browser, mailbox, signup)

    response = await confirm_email(browser, mailbox, signup)

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_signing_in_after_confirming_sets_the_session_cookies(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)

    response = await sign_in(browser, signup)

    assert response.status_code == 200, response.text
    assert (await browser.get("/v1/auth/me")).json()["email"] == signup.email

    session = cookie_attributes(response, SESSION_COOKIE)
    assert session["httponly"] and session["secure"]
    assert session["samesite"].lower() == "lax"
    assert session["path"] == "/"

    # Both tokens ride in the one cookie Firebase Hosting forwards -- see #273.
    carried = session_tokens(session["value"])
    assert carried["a"] and carried["r"]


async def test_the_wrong_password_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)

    response = await sign_in(browser, signup, password="not-the-right-one")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_an_unknown_address_is_refused_the_same_way(browser: AsyncClient) -> None:
    response = await sign_in(browser, a_signup())

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_an_identity_provider_that_is_down_is_a_502_not_a_500(settings: Settings) -> None:
    async with spa_onto(settings, supabase_url=UNREACHABLE_GOTRUE) as spa:
        response = await sign_in(spa, a_signup())

    assert response.status_code == 502
    assert response.json()["type"] == "urn:sync:problem:identity-provider-unavailable"


async def test_a_protected_route_needs_a_session(browser: AsyncClient) -> None:
    response = await browser.get("/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:not-authenticated"


async def test_a_protected_route_refuses_a_token_that_is_not_a_token(
    browser: AsyncClient,
) -> None:
    present_only(browser, SESSION_COOKIE, pack_session("not-a-jwt", ""))

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_a_soft_deleted_profile_cannot_act(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)

    await db_session.execute(update(Profile).values(deleted_at=dt.datetime.now(tz=dt.UTC)))
    await db_session.commit()

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_refreshing_rotates_the_session(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    before = session_tokens(browser.cookies[SESSION_COOKIE])["r"]

    response = await browser.post("/v1/auth/refresh")

    assert response.status_code == 200, response.text
    assert response.json()["email"] == signup.email
    assert session_tokens(browser.cookies[SESSION_COOKIE])["r"] != before
    assert (await browser.get("/v1/auth/me")).status_code == 200


async def test_refreshing_without_a_session_is_refused(browser: AsyncClient) -> None:
    response = await browser.post("/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:not-authenticated"


async def test_refreshing_with_a_token_that_was_never_issued_is_refused(
    browser: AsyncClient,
) -> None:
    present_only(browser, SESSION_COOKIE, pack_session("", "made-up"))

    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_revokes_the_session_at_the_identity_provider(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    refresh_token = session_tokens(browser.cookies[SESSION_COOKIE])["r"]

    assert (await browser.post("/v1/auth/logout")).status_code == 204

    present_only(browser, SESSION_COOKIE, pack_session("", refresh_token))
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_ends_the_sessions_on_other_devices_too(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    elsewhere = session_tokens(browser.cookies[SESSION_COOKIE])["r"]
    assert (await sign_in(browser, signup)).status_code == 200, "a second device signs in"

    assert (await browser.post("/v1/auth/logout")).status_code == 204

    present_only(browser, SESSION_COOKIE, pack_session("", elsewhere))
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_clears_the_session_cookie(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)

    response = await browser.post("/v1/auth/logout")

    assert cookie_attributes(response, SESSION_COOKIE)["value"] == ""
    assert SESSION_COOKIE not in browser.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


@pytest.mark.parametrize("cookie", ["", "not-a-jwt"])
async def test_logging_out_succeeds_whatever_the_caller_is_holding(
    browser: AsyncClient, cookie: str
) -> None:
    if cookie:
        present_only(browser, SESSION_COOKIE, cookie)

    assert (await browser.post("/v1/auth/logout")).status_code == 204
