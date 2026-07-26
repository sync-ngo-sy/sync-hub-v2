"""Arranging a Tenant and its Recruiters the way the self-serve flow arranges them.

Every helper goes through the same HTTP endpoints the recruiter portal calls — no test
reaches into GoTrue or the database to conjure a confirmed admin or an accepted invite, for
the same reason `tests.support.candidates` does not: a shortcut around signup is a shortcut
around the thing most likely to break.
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
class TenantSignup:
    """The five things a self-serve Tenant admin signs up with."""

    tenant_name: str
    tenant_slug: str
    email: str
    password: str
    full_name: str


def a_tenant_signup(
    label: str = "tenant", *, slug: str | None = None, password: str = DEFAULT_PASSWORD
) -> TenantSignup:
    """A never-before-seen Tenant signup, unless `slug` pins it to collide on purpose."""
    unique = uuid4().hex
    return TenantSignup(
        tenant_name=f"{label.title()} Recruiting {unique[:8]}",
        tenant_slug=slug or f"{label}-{unique}",
        email=f"{label}-admin-{unique}@example.com",
        password=password,
        full_name="Sami Khoury",
    )


async def sign_up_tenant(browser: AsyncClient, signup: TenantSignup) -> Response:
    return await browser.post(
        "/v1/auth/signup/tenant",
        json={
            "tenant_name": signup.tenant_name,
            "tenant_slug": signup.tenant_slug,
            "email": signup.email,
            "password": signup.password,
            "full_name": signup.full_name,
        },
    )


async def confirm_tenant_admin_email(
    browser: AsyncClient, mailbox: Mailbox, signup: TenantSignup
) -> Response:
    """Follow the confirmation link, which is also what signs the admin in."""
    token_hash = await mailbox.confirmation_token(signup.email)
    return await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})


async def a_confirmed_tenant_admin(
    browser: AsyncClient, mailbox: Mailbox, label: str = "tenant"
) -> TenantSignup:
    """Sign up a Tenant + admin Recruiter, confirm, and come back with an empty cookie jar."""
    signup = a_tenant_signup(label)
    signed_up = await sign_up_tenant(browser, signup)
    assert signed_up.status_code == 201, signed_up.text
    confirmed = await confirm_tenant_admin_email(browser, mailbox, signup)
    assert confirmed.status_code == 200, confirmed.text
    browser.cookies.clear()
    return signup


async def log_in_recruiter(
    browser: AsyncClient, email: str, *, password: str = DEFAULT_PASSWORD
) -> Response:
    return await browser.post("/v1/auth/login", json={"email": email, "password": password})


async def invite_recruiter(
    browser: AsyncClient,
    *,
    email: str | None = None,
    full_name: str = "Nadia Youssef",
    role: str = "recruiter",
    label: str = "teammate",
) -> Response:
    return await browser.post(
        "/v1/tenants/recruiters",
        json={
            "email": email or f"{label}-{uuid4().hex}@example.com",
            "full_name": full_name,
            "role": role,
        },
    )


async def accept_invite(
    browser: AsyncClient, mailbox: Mailbox, email: str, *, password: str = DEFAULT_PASSWORD
) -> Response:
    token_hash = await mailbox.confirmation_token(email)
    return await browser.post(
        "/v1/auth/accept-invite", json={"token_hash": token_hash, "password": password}
    )


async def an_accepted_teammate(
    admin_browser: AsyncClient,
    invitee_browser: AsyncClient,
    mailbox: Mailbox,
    *,
    role: str = "recruiter",
    label: str = "teammate",
) -> tuple[str, str]:
    """Invite a teammate as `admin_browser` and accept as `invitee_browser`.

    Returns `(recruiter_id, email)`. `invitee_browser` is left signed in; `admin_browser`'s
    cookies are untouched, so the caller keeps acting as the admin afterwards.
    """
    invited = await invite_recruiter(admin_browser, role=role, label=label)
    assert invited.status_code == 201, invited.text
    body = invited.json()
    accepted = await accept_invite(invitee_browser, mailbox, body["email"])
    assert accepted.status_code == 200, accepted.text
    return body["id"], body["email"]
