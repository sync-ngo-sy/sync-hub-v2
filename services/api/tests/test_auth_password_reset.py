"""Forgetting a password and getting back in.

Two calls with an email between them, so the round trip is only real if the mail is really
sent and its token really works — which is why these tests read the stack's mailbox rather
than the token column behind it.
"""

from __future__ import annotations

from httpx import AsyncClient

from sync_api.auth import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
from tests.support.candidates import a_confirmed_candidate, an_account, sign_in
from tests.support.harness import present_only
from tests.support.mailbox import Mailbox

A_NEW_PASSWORD = "a-brand-new-passphrase"


async def ask_to_reset(browser: AsyncClient, email: str) -> None:
    response = await browser.post("/v1/auth/password-reset", json={"email": email})
    assert response.status_code == 202, response.text


async def test_a_forgotten_password_can_be_replaced(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, account.email)

    response = await browser.post(
        "/v1/auth/password-reset/confirm",
        json={
            "token_hash": await mailbox.confirmation_token(account.email),
            "password": A_NEW_PASSWORD,
        },
    )

    assert response.status_code == 204, response.text
    assert (await sign_in(browser, account, password=A_NEW_PASSWORD)).status_code == 200
    browser.cookies.clear()
    assert (await sign_in(browser, account)).status_code == 401


async def test_resetting_ends_the_sessions_the_account_already_had(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Somebody resetting a password may be locking an intruder out. It has to work."""
    account = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, account)
    intruders_refresh_token = browser.cookies[REFRESH_TOKEN_COOKIE]

    await ask_to_reset(browser, account.email)
    await browser.post(
        "/v1/auth/password-reset/confirm",
        json={
            "token_hash": await mailbox.confirmation_token(account.email),
            "password": A_NEW_PASSWORD,
        },
    )

    present_only(browser, REFRESH_TOKEN_COOKIE, intruders_refresh_token, path="/v1/auth")
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_a_reset_link_works_only_once(browser: AsyncClient, mailbox: Mailbox) -> None:
    account = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, account.email)
    token_hash = await mailbox.confirmation_token(account.email)
    body = {"token_hash": token_hash, "password": A_NEW_PASSWORD}
    await browser.post("/v1/auth/password-reset/confirm", json=body)

    response = await browser.post("/v1/auth/password-reset/confirm", json=body)

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_confirming_a_reset_starts_no_session(browser: AsyncClient, mailbox: Mailbox) -> None:
    """The recovery token buys a session at GoTrue; none of it reaches the caller."""
    account = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, account.email)

    await browser.post(
        "/v1/auth/password-reset/confirm",
        json={
            "token_hash": await mailbox.confirmation_token(account.email),
            "password": A_NEW_PASSWORD,
        },
    )

    assert ACCESS_TOKEN_COOKIE not in browser.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_asking_to_reset_an_unknown_address_reveals_nothing(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Accepted exactly as a known address is, so this is not an account-existence oracle."""
    stranger = an_account("stranger")

    await ask_to_reset(browser, stranger.email)

    assert await mailbox.count_for(stranger.email) == 0


async def test_a_reset_will_not_set_a_short_password(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    account = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, account.email)

    response = await browser.post(
        "/v1/auth/password-reset/confirm",
        json={
            "token_hash": await mailbox.confirmation_token(account.email),
            "password": "short",
        },
    )

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.password"]
    assert (await sign_in(browser, account)).status_code == 200
