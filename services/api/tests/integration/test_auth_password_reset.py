from __future__ import annotations

from httpx import AsyncClient, Response

from sync_api.auth import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
from tests.support.candidates import a_confirmed_candidate, a_signup, sign_in
from tests.support.harness import present_only
from tests.support.mailbox import Mailbox

A_NEW_PASSWORD = "a-brand-new-passphrase"


async def ask_to_reset(browser: AsyncClient, email: str) -> None:
    response = await browser.post("/v1/auth/password-reset", json={"email": email})
    assert response.status_code == 202, response.text


async def follow_the_reset_link(
    browser: AsyncClient, mailbox: Mailbox, email: str, password: str = A_NEW_PASSWORD
) -> Response:
    return await browser.post(
        "/v1/auth/password-reset/confirm",
        json={"token_hash": await mailbox.confirmation_token(email), "password": password},
    )


async def test_a_forgotten_password_can_be_replaced(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)

    response = await follow_the_reset_link(browser, mailbox, signup.email)

    assert response.status_code == 204, response.text
    assert (await sign_in(browser, signup, password=A_NEW_PASSWORD)).status_code == 200
    browser.cookies.clear()
    assert (await sign_in(browser, signup)).status_code == 401


async def test_resetting_ends_the_sessions_that_were_already_open(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await sign_in(browser, signup)
    intruders_refresh_token = browser.cookies[REFRESH_TOKEN_COOKIE]

    await ask_to_reset(browser, signup.email)
    await follow_the_reset_link(browser, mailbox, signup.email)

    present_only(browser, REFRESH_TOKEN_COOKIE, intruders_refresh_token, path="/v1/auth")
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_a_reset_link_works_only_once(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)
    await follow_the_reset_link(browser, mailbox, signup.email)

    response = await follow_the_reset_link(browser, mailbox, signup.email)

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:invalid-email-token"


async def test_confirming_a_reset_starts_no_session(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)

    await follow_the_reset_link(browser, mailbox, signup.email)

    assert ACCESS_TOKEN_COOKIE not in browser.cookies
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_asking_to_reset_an_unknown_address_reveals_nothing(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    stranger = a_signup("stranger")

    await ask_to_reset(browser, stranger.email)

    assert await mailbox.count_for(stranger.email) == 0


async def test_a_reset_will_not_set_a_short_password(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)

    response = await follow_the_reset_link(browser, mailbox, signup.email, password="short")

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["body.password"]
    assert (await sign_in(browser, signup)).status_code == 200
