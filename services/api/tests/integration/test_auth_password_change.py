from __future__ import annotations

from typing import TYPE_CHECKING

from httpx import AsyncClient, Response

from sync_api.auth import SESSION_COOKIE, pack_session
from sync_core import Settings
from tests.support.candidates import DEFAULT_PASSWORD, a_signed_in_candidate, sign_in
from tests.support.harness import present_only, session_tokens, spa_onto
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from tests.support.mailbox import Mailbox

CHANGE = "/v1/auth/password"

A_NEW_PASSWORD = "A-Brand-New-Passphrase1"

A_WRONG_PASSWORD = "Not-The-Password9"

A_TIGHT_LIMIT = 2


async def change_password(
    browser: AsyncClient, *, current: str = DEFAULT_PASSWORD, new: str = A_NEW_PASSWORD
) -> Response:
    return await browser.post(CHANGE, json={"current_password": current, "new_password": new})


async def test_a_signed_in_candidate_can_change_their_password(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)

    response = await change_password(browser)

    assert response.status_code == 204, response.text
    browser.cookies.clear()
    assert (await sign_in(browser, signup, password=A_NEW_PASSWORD)).status_code == 200
    browser.cookies.clear()
    assert (await sign_in(browser, signup)).status_code == 401


async def test_a_recruiter_can_change_their_password_too(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    response = await change_password(browser)

    assert response.status_code == 204, response.text


async def test_the_wrong_current_password_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)

    response = await change_password(browser, current=A_WRONG_PASSWORD)

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:invalid-credentials"
    browser.cookies.clear()
    assert (await sign_in(browser, signup)).status_code == 200, "the password is untouched"


async def test_a_weak_new_password_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)

    response = await change_password(browser, new="short1")

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:weak-password"
    browser.cookies.clear()
    assert (await sign_in(browser, signup)).status_code == 200, "the password is untouched"


async def test_the_current_password_cannot_be_kept(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await change_password(browser, new=DEFAULT_PASSWORD)

    assert response.status_code == 400
    assert response.json()["type"] == "urn:sync:problem:password-unchanged"


async def test_changing_ends_the_sessions_open_elsewhere(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)
    elsewhere = session_tokens(browser.cookies[SESSION_COOKIE])["r"]
    assert (await sign_in(browser, signup)).status_code == 200, "a second device signs in"

    assert (await change_password(browser)).status_code == 204

    present_only(browser, SESSION_COOKIE, pack_session("", elsewhere))
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_the_caller_stays_signed_in_on_a_fresh_session(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)
    assert (await sign_in(browser, signup)).status_code == 200, "a second device signs in"
    before = browser.cookies[SESSION_COOKIE]

    assert (await change_password(browser)).status_code == 204

    assert browser.cookies[SESSION_COOKIE] != before, "the cookie carries a new session"
    assert (await browser.get("/v1/auth/me")).status_code == 200
    # /v1/auth/me answers on a JWT that outlives the session it names, so it says nothing about
    # the session itself. Only a refresh does.
    assert (await browser.post("/v1/auth/refresh")).status_code == 200


async def test_the_session_the_caller_arrived_on_is_ended_as_well(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """GoTrue spares nothing when an admin sets a password, thus the caller's own session goes
    too and is replaced. Nothing minted before the change outlives it."""
    await a_signed_in_candidate(browser, mailbox)
    arrived_on = session_tokens(browser.cookies[SESSION_COOKIE])["r"]

    assert (await change_password(browser)).status_code == 204

    present_only(browser, SESSION_COOKIE, pack_session("", arrived_on))
    assert (await browser.post("/v1/auth/refresh")).status_code == 401


async def test_changing_a_password_needs_a_session(browser: AsyncClient) -> None:
    response = await change_password(browser)

    assert response.status_code == 401
    assert response.json()["type"] == "urn:sync:problem:not-authenticated"


async def test_repeated_wrong_guesses_are_rate_limited(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with spa_onto(settings, auth_rate_limit_max_requests=A_TIGHT_LIMIT) as spa:
        await a_signed_in_candidate(spa, mailbox)
        for _ in range(A_TIGHT_LIMIT):
            assert (await change_password(spa, current=A_WRONG_PASSWORD)).status_code == 401

        response = await change_password(spa, current=A_WRONG_PASSWORD)

    assert response.status_code == 429
    assert response.json()["type"] == "urn:sync:problem:rate-limited"
