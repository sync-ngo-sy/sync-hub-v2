"""Arranging a candidate the way a candidate arranges themselves.

Every helper here goes through the same HTTP endpoints the SPA calls — no test reaches
into GoTrue or the database to conjure a confirmed account, because a shortcut around
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
class Account:
    """The three things a candidate signs up with."""

    email: str
    password: str
    full_name: str


def an_account(label: str = "candidate", *, password: str = DEFAULT_PASSWORD) -> Account:
    """A never-before-seen account.

    Unique per call because `auth.users` is truncated between tests but the stack's mailbox
    is not — the address is what keeps a test reading its own mail.
    """
    return Account(
        email=f"{label}-{uuid4().hex}@example.com",
        password=password,
        full_name="Amina Haddad",
    )


async def sign_up(browser: AsyncClient, account: Account) -> Response:
    return await browser.post(
        "/v1/auth/signup",
        json={
            "email": account.email,
            "password": account.password,
            "full_name": account.full_name,
        },
    )


async def sign_in(
    browser: AsyncClient, account: Account, *, password: str | None = None
) -> Response:
    return await browser.post(
        "/v1/auth/login",
        json={"email": account.email, "password": password or account.password},
    )


async def confirm_email(browser: AsyncClient, mailbox: Mailbox, account: Account) -> Response:
    """Follow the confirmation link, which is also what signs the candidate in."""
    token_hash = await mailbox.confirmation_token(account.email)
    return await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})


async def a_confirmed_candidate(
    browser: AsyncClient, mailbox: Mailbox, label: str = "candidate"
) -> Account:
    """Sign up, confirm, and come back later with an empty cookie jar."""
    account = an_account(label)
    signed_up = await sign_up(browser, account)
    assert signed_up.status_code == 201, signed_up.text
    confirmed = await confirm_email(browser, mailbox, account)
    assert confirmed.status_code == 200, confirmed.text
    browser.cookies.clear()
    return account
