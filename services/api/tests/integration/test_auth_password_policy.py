"""The policy on every path that sets a password, checked against the real stack.

The portals show a checklist as the visitor types. These are the tests that say the checklist is
a courtesy: a request that skips the portal entirely is refused just the same.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth.password_policy import PasswordPolicyError
from sync_api.platform import create_platform_admin
from sync_core.models import Profile
from tests.support.candidates import a_confirmed_candidate, a_signup, sign_in, sign_up
from tests.support.mailbox import Mailbox
from tests.support.platform_admins import a_platform_admin_signup
from tests.support.tenants import accept_invite, an_admin, an_invitee_address, invite

WEAK_PASSWORD = "urn:sync:problem:weak-password"

CONFORMING = "CorrectHorse9"

REFUSED = [
    pytest.param("Ab1defg", "at least 8 characters", id="too-short"),
    pytest.param("correcthorse9", "an uppercase letter", id="no-uppercase"),
    pytest.param("CORRECTHORSE9", "a lowercase letter", id="no-lowercase"),
    pytest.param("CorrectHorse", "a digit", id="no-digit"),
]


async def ask_to_reset(browser: AsyncClient, email: str) -> None:
    response = await browser.post("/v1/auth/password-reset", json={"email": email})
    assert response.status_code == 202, response.text


async def confirm_reset(
    browser: AsyncClient, mailbox: Mailbox, email: str, *, password: str
) -> Response:
    return await browser.post(
        "/v1/auth/password-reset/confirm",
        json={"token_hash": await mailbox.confirmation_token(email), "password": password},
    )


@pytest.mark.parametrize(("password", "requirement"), REFUSED)
async def test_signup_refuses_a_password_below_the_policy(
    browser: AsyncClient, db_session: AsyncSession, password: str, requirement: str
) -> None:
    response = await sign_up(browser, a_signup(password=password))

    assert response.status_code == 400, response.text
    body = response.json()
    assert body["type"] == WEAK_PASSWORD
    assert requirement in body["detail"]
    assert (await db_session.execute(select(Profile))).first() is None


async def test_signup_names_every_requirement_a_password_misses(browser: AsyncClient) -> None:
    response = await sign_up(browser, a_signup(password="horse"))

    assert response.json()["detail"] == (
        "That password needs at least 8 characters, an uppercase letter and a digit."
    )


async def test_signup_takes_a_password_that_meets_the_policy(browser: AsyncClient) -> None:
    response = await sign_up(browser, a_signup(password=CONFORMING))

    assert response.status_code == 201, response.text


@pytest.mark.parametrize(("password", "requirement"), REFUSED)
async def test_a_reset_refuses_a_password_below_the_policy(
    browser: AsyncClient, mailbox: Mailbox, password: str, requirement: str
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)

    response = await confirm_reset(browser, mailbox, signup.email, password=password)

    assert response.status_code == 400, response.text
    body = response.json()
    assert body["type"] == WEAK_PASSWORD
    assert requirement in body["detail"]


async def test_a_reset_refused_by_the_policy_spends_neither_the_link_nor_the_old_password(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_confirmed_candidate(browser, mailbox)
    await ask_to_reset(browser, signup.email)

    refused = await confirm_reset(browser, mailbox, signup.email, password="tooweak")
    assert refused.status_code == 400, refused.text
    assert (await sign_in(browser, signup)).status_code == 200
    browser.cookies.clear()

    accepted = await confirm_reset(browser, mailbox, signup.email, password=CONFORMING)
    assert accepted.status_code == 204, accepted.text
    assert (await sign_in(browser, signup, password=CONFORMING)).status_code == 200


@pytest.mark.parametrize(("password", "requirement"), REFUSED)
async def test_accepting_an_invite_refuses_a_password_below_the_policy(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    password: str,
    requirement: str,
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    assert (await invite(browser, email=email)).status_code == 201

    response = await accept_invite(other_browser, mailbox, email, password=password)

    assert response.status_code == 400, response.text
    body = response.json()
    assert body["type"] == WEAK_PASSWORD
    assert requirement in body["detail"]


@pytest.mark.parametrize(("password", "requirement"), REFUSED)
async def test_the_bootstrap_refuses_a_password_below_the_policy(
    app: FastAPI, db_session: AsyncSession, password: str, requirement: str
) -> None:
    """The operator account is made by a script rather than a route, and is held to the same
    policy — otherwise the one account with the most reach could have the weakest password."""
    signup = a_platform_admin_signup()

    with pytest.raises(PasswordPolicyError) as refused:
        await create_platform_admin(
            db_session,
            app.state.authentication.gotrue,
            email=signup.email,
            password=password,
            full_name=signup.full_name,
        )

    assert requirement in str(refused.value)
    assert (await db_session.execute(select(Profile))).first() is None


async def test_an_invite_refused_by_the_policy_stays_usable(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    email = an_invitee_address()
    assert (await invite(browser, email=email)).status_code == 201

    refused = await accept_invite(other_browser, mailbox, email, password="tooweak")
    assert refused.status_code == 400, refused.text

    accepted = await accept_invite(other_browser, mailbox, email, password=CONFORMING)
    assert accepted.status_code == 200, accepted.text
