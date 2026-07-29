from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import uuid4

if TYPE_CHECKING:
    from httpx import AsyncClient, Response

    from tests.support.mailbox import Mailbox

DEFAULT_PASSWORD: Final = "correct-horse-battery"

DELETION: Final = "/v1/candidates/me/deletion"


@dataclass(frozen=True, slots=True)
class Signup:
    email: str
    password: str
    full_name: str


def a_signup(label: str = "candidate", *, password: str = DEFAULT_PASSWORD) -> Signup:
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
    token_hash = await mailbox.confirmation_token(signup.email)
    return await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})


async def delete_my_account(browser: AsyncClient, password: str = DEFAULT_PASSWORD) -> Response:
    return await browser.post(DELETION, json={"password": password})


async def a_deleted_account(browser: AsyncClient, password: str = DEFAULT_PASSWORD) -> None:
    response = await delete_my_account(browser, password)
    assert response.status_code == 204, response.text


async def a_confirmed_candidate(
    browser: AsyncClient, mailbox: Mailbox, label: str = "candidate"
) -> Signup:
    signup = await a_signed_in_candidate(browser, mailbox, label)
    browser.cookies.clear()
    return signup


async def a_signed_in_candidate(
    browser: AsyncClient, mailbox: Mailbox, label: str = "candidate"
) -> Signup:
    signup = a_signup(label)
    signed_up = await sign_up(browser, signup)
    assert signed_up.status_code == 201, signed_up.text
    confirmed = await confirm_email(browser, mailbox, signup)
    assert confirmed.status_code == 200, confirmed.text
    return signup
