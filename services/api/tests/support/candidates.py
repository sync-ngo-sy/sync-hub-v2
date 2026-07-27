"""Arranging a candidate the way a candidate arranges themselves.

Every helper here goes through the same HTTP endpoints the SPA calls — no test reaches
into GoTrue or the database to conjure a confirmed candidate, because a shortcut around
signup is a shortcut around the thing most likely to break.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import uuid4

if TYPE_CHECKING:
    from httpx import AsyncClient, Response

    from tests.support.mailbox import Mailbox

DEFAULT_PASSWORD: Final = "correct-horse-battery"


@dataclass(frozen=True, slots=True)
class Signup:
    """The three things a candidate signs up with."""

    email: str
    password: str
    full_name: str


def a_signup(label: str = "candidate", *, password: str = DEFAULT_PASSWORD) -> Signup:
    """A never-before-seen signup.

    Unique per call because `auth.users` is truncated between tests but the stack's mailbox
    is not — the address is what keeps a test reading its own mail.
    """
    return Signup(
        email=f"{label}-{uuid4().hex}@example.com",
        password=password,
        full_name="Amina Haddad",
    )


async def sign_up(browser: AsyncClient, signup: Signup) -> Response:
    return await browser.post(
        "/v1/auth/signup",
        json={
            "email": signup.email,
            "password": signup.password,
            "full_name": signup.full_name,
        },
    )


async def sign_in(browser: AsyncClient, signup: Signup, *, password: str | None = None) -> Response:
    return await browser.post(
        "/v1/auth/login",
        json={"email": signup.email, "password": password or signup.password},
    )


async def confirm_email(browser: AsyncClient, mailbox: Mailbox, signup: Signup) -> Response:
    """Follow the confirmation link, which is also what signs the candidate in."""
    token_hash = await mailbox.confirmation_token(signup.email)
    return await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})


async def a_confirmed_candidate(
    browser: AsyncClient, mailbox: Mailbox, label: str = "candidate"
) -> Signup:
    """Sign up, confirm, and come back later with an empty cookie jar."""
    signup = await a_signed_in_candidate(browser, mailbox, label)
    browser.cookies.clear()
    return signup


async def a_signed_in_candidate(
    browser: AsyncClient, mailbox: Mailbox, label: str = "candidate"
) -> Signup:
    """Sign up and confirm, leaving `browser` holding the session confirmation handed back.

    Confirming *is* signing in (ADR-0005), so a test that wants a candidate who can act
    needs no login call of its own.
    """
    signup = a_signup(label)
    signed_up = await sign_up(browser, signup)
    assert signed_up.status_code == 201, signed_up.text
    confirmed = await confirm_email(browser, mailbox, signup)
    assert confirmed.status_code == 200, confirmed.text
    return signup
