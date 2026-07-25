"""Confirming, signing in, staying signed in, and signing out.

Everything here goes through cookies rather than through tokens, because that is the whole
point of ADR-0005: the SPA sends a request, the browser attaches the session, and no
JavaScript anywhere is holding anything worth stealing.
"""

from __future__ import annotations

import datetime as dt

import pytest
from httpx import AsyncClient
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
from sync_core import Settings
from sync_core.models import Profile
from tests.support.candidates import (
    a_confirmed_candidate,
    a_signup,
    confirm_email,
    sign_in,
    sign_up,
)
from tests.support.harness import cookie_attributes, present_only, spa_onto
from tests.support.mailbox import Mailbox

#: Nothing listens here, so every call to GoTrue fails the way an outage does.
UNREACHABLE_GOTRUE = "http://127.0.0.1:1"


async def test_signing_in_before_confirming_is_refused(browser: AsyncClient) -> None:
    signup = a_signup()
    await sign_up(browser, signup)

    response = await sign_in(browser, signup)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:email-not-confirmed"
    assert ACCESS_TOKEN_COOKIE not in browser.cookies


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

    access = cookie_attributes(response, ACCESS_TOKEN_COOKIE)
    assert access["httponly"] and access["secure"]
    assert access["samesite"].lower() == "lax"
    assert access["path"] == "/"

    refresh = cookie_attributes(response, REFRESH_TOKEN_COOKIE)
    assert refresh["httponly"] and refresh["secure"]
    # Scoped to the two routes that spend it, so it is absent from every other request.
    assert refresh["path"] == "/v1/auth"


async def test_the_wrong_password_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)

    response = await sign_in(browser, signup, password="not-the-right-one")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_an_unknown_address_is_refused_the_same_way(browser: AsyncClient) -> None:
    """Same problem type as a wrong password: signing in must not reveal who has an account."""
    response = await sign_in(browser, a_signup())

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_an_identity_provider_that_is_down_is_a_502_not_a_500(settings: Settings) -> None:
    """GoTrue being unreachable is not our bug, and the client should be able to tell.

    Nothing catches this per flow — one handler on the application answers for all of them,
    so this covers every route that reaches GoTrue, not only login.
    """
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
    present_only(browser, ACCESS_TOKEN_COOKIE, "not-a-jwt")

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_a_soft_deleted_profile_cannot_act(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Deleting a Profile has to end its sessions even while its access token is still valid."""
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)

    await db_session.execute(update(Profile).values(deleted_at=dt.datetime.now(tz=dt.UTC)))
    await db_session.commit()

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_refreshing_rotates_the_session(browser: AsyncClient, mailbox: Mailbox) -> None:
    """A new refresh token replaces the old one, and the session carries on.

    What is *not* asserted is that the old token dies on the spot, because it does not:
    `refresh_token_reuse_interval` in `supabase/config.toml` deliberately keeps it working
    for a few seconds, so two tabs refreshing at once do not sign each other out. The
    property that matters — a refresh token that stops working for good — is what
    `test_logging_out_revokes_the_session_at_the_identity_provider` covers.
    """
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    before = browser.cookies[REFRESH_TOKEN_COOKIE]

    response = await browser.post("/v1/auth/refresh")

    assert response.status_code == 200, response.text
    assert response.json()["email"] == signup.email
    assert browser.cookies[REFRESH_TOKEN_COOKIE] != before
    assert (await browser.get("/v1/auth/me")).status_code == 200


async def test_refreshing_without_a_session_is_refused(browser: AsyncClient) -> None:
    response = await browser.post("/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:not-authenticated"


async def test_refreshing_with_a_token_that_was_never_issued_is_refused(
    browser: AsyncClient,
) -> None:
    present_only(browser, REFRESH_TOKEN_COOKIE, "made-up", path="/v1/auth")

    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_revokes_the_session_at_the_identity_provider(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Not merely a cookie wipe: the refresh token has to be dead on the server too.

    The access token stays valid until it expires — a stateless JWT cannot be recalled, and
    ADR-0005 verifies claims rather than checking a revocation list per request. What logout
    guarantees is that the session cannot be *extended*: no refresh, so at most one token
    lifetime after logging out, the signup is unreachable.
    """
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    refresh_token = browser.cookies[REFRESH_TOKEN_COOKIE]

    assert (await browser.post("/v1/auth/logout")).status_code == 204

    present_only(browser, REFRESH_TOKEN_COOKIE, refresh_token, path="/v1/auth")
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_clears_the_cookies(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)

    response = await browser.post("/v1/auth/logout")

    assert cookie_attributes(response, ACCESS_TOKEN_COOKIE)["value"] == ""
    assert cookie_attributes(response, REFRESH_TOKEN_COOKIE)["value"] == ""
    assert ACCESS_TOKEN_COOKIE not in browser.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


@pytest.mark.parametrize("cookie", ["", "not-a-jwt"])
async def test_logging_out_succeeds_whatever_the_caller_is_holding(
    browser: AsyncClient, cookie: str
) -> None:
    """A logout that could fail would be a way to keep somebody signed in."""
    if cookie:
        present_only(browser, ACCESS_TOKEN_COOKIE, cookie)

    assert (await browser.post("/v1/auth/logout")).status_code == 204
