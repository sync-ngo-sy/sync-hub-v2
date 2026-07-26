"""Arranging a tenant the way a hiring company arranges itself.

Same rule as `candidates.py`: every helper goes through the HTTP endpoints a recruiter's
browser would call. No test conjures a tenant by inserting rows, because the interesting
part of onboarding is precisely the ordering of the writes a shortcut would skip.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import update

from sync_core.models import RecruiterRole, Tenant
from tests.support.candidates import DEFAULT_PASSWORD

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


@dataclass(frozen=True, slots=True)
class TenantSignup:
    """What a hiring company self-serves with: an organization and its first admin."""

    tenant_name: str
    slug: str
    email: str
    password: str
    full_name: str


def a_tenant_signup(label: str = "acme", *, slug: str | None = None) -> TenantSignup:
    """A never-before-seen tenant signup.

    Unique per call for the same reason a candidate signup is: `auth.users` is truncated
    between tests, the stack's mailbox is not, and the address is how a test finds its mail.
    """
    unique = uuid4().hex
    return TenantSignup(
        tenant_name="Acme Recruiting",
        slug=slug if slug is not None else f"{label}-{unique}",
        email=f"{label}-admin-{unique}@example.com",
        password=DEFAULT_PASSWORD,
        full_name="Rana Khalil",
    )


async def sign_up_tenant(browser: AsyncClient, signup: TenantSignup) -> Response:
    return await browser.post(
        "/v1/tenants",
        json={
            "tenant_name": signup.tenant_name,
            "slug": signup.slug,
            "email": signup.email,
            "password": signup.password,
            "full_name": signup.full_name,
        },
    )


async def an_admin(browser: AsyncClient, mailbox: Mailbox, label: str = "acme") -> TenantSignup:
    """Sign a tenant up and confirm its admin, leaving `browser` signed in as that admin."""
    signup = a_tenant_signup(label)
    signed_up = await sign_up_tenant(browser, signup)
    assert signed_up.status_code == 201, signed_up.text
    token_hash = await mailbox.confirmation_token(signup.email)
    confirmed = await browser.post("/v1/auth/confirm-email", json={"token_hash": token_hash})
    assert confirmed.status_code == 200, confirmed.text
    return signup


async def invite(
    browser: AsyncClient,
    *,
    email: str,
    full_name: str = "Yusuf Nasser",
    role: RecruiterRole = RecruiterRole.RECRUITER,
) -> Response:
    return await browser.post(
        "/v1/tenants/me/members",
        json={"email": email, "full_name": full_name, "role": role.value},
    )


def an_invitee_address(label: str = "teammate") -> str:
    return f"{label}-{uuid4().hex}@example.com"


async def accept_invite(
    browser: AsyncClient, mailbox: Mailbox, email: str, *, password: str = DEFAULT_PASSWORD
) -> Response:
    """Follow the invite link and choose a password, which is also what signs them in."""
    token_hash = await mailbox.confirmation_token(email)
    return await browser.post(
        "/v1/auth/accept-invite", json={"token_hash": token_hash, "password": password}
    )


async def a_teammate(
    admin_browser: AsyncClient,
    browser: AsyncClient,
    mailbox: Mailbox,
    *,
    role: RecruiterRole = RecruiterRole.RECRUITER,
    label: str = "teammate",
) -> dict[str, Any]:
    """Invite someone through `admin_browser` and accept it in `browser`, which they keep.

    Two clients because they are two people: an invite accepted in the admin's own cookie
    jar would replace the admin's session with the invitee's. Returns the new member.
    """
    email = an_invitee_address(label)
    invited = await invite(admin_browser, email=email, role=role)
    assert invited.status_code == 201, invited.text
    accepted = await accept_invite(browser, mailbox, email)
    assert accepted.status_code == 200, accepted.text
    member: dict[str, Any] = invited.json()
    return member


async def change_member(browser: AsyncClient, member_id: str, **changes: Any) -> Response:
    return await browser.patch(f"/v1/tenants/me/members/{member_id}", json=changes)


async def set_tenant_active(session: AsyncSession, slug: str, *, is_active: bool) -> None:
    """Throw the operator's kill-switch, or take it back off.

    Written straight into Postgres because that is the whole of where it lives: pausing a
    Tenant is something Sync does to a customer, not something a customer does, so the API
    deliberately offers no route for it. What the tests check is the effect it has.
    """
    await session.execute(update(Tenant).where(Tenant.slug == slug).values(is_active=is_active))
    await session.commit()
