"""Confirming, signing in, staying signed in, and signing out.

Everything here goes through cookies rather than through tokens, because that is the whole
point of ADR-0005: the SPA sends a request, the browser attaches the session, and no
JavaScript anywhere is holding anything worth stealing.
"""

from __future__ import annotations

import datetime as dt

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
from sync_core.models import Profile
from tests.support import stack
from tests.support.candidates import (
    a_confirmed_candidate,
    an_account,
    confirm_email,
    sign_in,
    sign_up,
)
from tests.support.harness import cookie_attributes, present_only
from tests.support.mailbox import Mailbox


async def test_signing_in_before_confirming_is_refused(browser: AsyncClient) -> None:
    account = an_account()
    await sign_up(browser, account)

    response = await sign_in(browser, account)

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:email-not-confirmed"
    assert ACCESS_TOKEN_COOKIE not in browser.cookies


async def test_confirming_the_address_signs_the_candidate_in(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    account = an_account()
    await sign_up(browser, account)

    response = await confirm_email(browser, mailbox, account)

    assert response.status_code == 200, response.text
    assert response.json()["email"] == account.email

    confirmed_at = await db_session.scalar(
        text("select email_confirmed_at from auth.users where email = :email").bindparams(
            email=account.email
        )
    )
    assert confirmed_at is not None

    me = await browser.get("/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == account.email


async def test_a_confirmation_link_works_only_once(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = an_account()
    await sign_up(browser, account)
    await confirm_email(browser, mailbox, account)

    response = await confirm_email(browser, mailbox, account)

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_signing_in_after_confirming_sets_the_session_cookies(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    account = await a_confirmed_candidate(browser, mailbox)

    response = await sign_in(browser, account)

    assert response.status_code == 200, response.text
    assert (await browser.get("/v1/auth/me")).json()["email"] == account.email

    access = cookie_attributes(response, ACCESS_TOKEN_COOKIE)
    assert access["httponly"] and access["secure"]
    assert access["samesite"].lower() == "lax"
    assert access["path"] == "/"

    refresh = cookie_attributes(response, REFRESH_TOKEN_COOKIE)
    assert refresh["httponly"] and refresh["secure"]
    # Scoped to the two routes that spend it, so it is absent from every other request.
    assert refresh["path"] == "/v1/auth"


async def test_the_wrong_password_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = await a_confirmed_candidate(browser, mailbox)

    response = await sign_in(browser, account, password="not-the-right-one")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_an_unknown_address_is_refused_the_same_way(browser: AsyncClient) -> None:
    """Same problem type as a wrong password: signing in must not reveal who has an account."""
    response = await sign_in(browser, an_account())

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"


async def test_a_protected_route_needs_a_session(browser: AsyncClient) -> None:
    response = await browser.get("/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:not-authenticated"


async def test_a_protected_route_refuses_a_token_that_is_not_a_token(
    browser: AsyncClient,
) -> None:
    present_only(browser, ACCESS_TOKEN_COOKIE, "not-a-jwt")

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_a_protected_route_refuses_a_token_signed_with_the_shared_secret(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The algorithm-confusion attack, which local JWKS verification exists to stop.

    A Supabase project publishes an asymmetric signing key *and* keeps a legacy shared HS256
    secret that other services hold. A verifier willing to accept HS256 would take a token
    forged with that secret — or, worse, one signed using the published public key as the
    HMAC key, which anybody can do. Only asymmetric algorithms are accepted, so neither
    works, and every claim in the forgery below is otherwise perfectly in order.
    """
    account = await a_confirmed_candidate(browser, mailbox)
    genuine = (await sign_in(browser, account)).cookies[ACCESS_TOKEN_COOKIE]
    claims = jwt.decode(genuine, options={"verify_signature": False})

    forged = jwt.encode(
        claims,
        stack.stack_config()["JWT_SECRET"],
        algorithm="HS256",
        headers={"kid": jwt.get_unverified_header(genuine)["kid"]},
    )
    present_only(browser, ACCESS_TOKEN_COOKIE, forged)

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_a_soft_deleted_profile_cannot_act(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Deleting an account has to end its sessions even while its access token is still valid."""
    account = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, account)

    await db_session.execute(update(Profile).values(deleted_at=dt.datetime.now(tz=dt.UTC)))
    await db_session.commit()

    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_refreshing_rotates_the_session(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, account)
    before = browser.cookies[REFRESH_TOKEN_COOKIE]

    response = await browser.post("/v1/auth/refresh")

    assert response.status_code == 200, response.text
    assert response.json()["email"] == account.email
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
    ADR-0005 chose local verification over a revocation check on every request. What logout
    guarantees is that the session cannot be *extended*: no refresh, so at most one token
    lifetime after logging out, the account is unreachable.
    """
    account = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, account)
    refresh_token = browser.cookies[REFRESH_TOKEN_COOKIE]

    assert (await browser.post("/v1/auth/logout")).status_code == 204

    present_only(browser, REFRESH_TOKEN_COOKIE, refresh_token, path="/v1/auth")
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_logging_out_clears_the_cookies(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, account)

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
