from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import update

from sync_api.platform import PlatformService
from sync_core.models import RecruiterRole, Tenant
from tests.conftest import RECRUITER_PORTAL_URL
from tests.support.candidates import DEFAULT_PASSWORD
from tests.support.harness import app_of

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


@dataclass(frozen=True, slots=True)
class FoundedTenant:
    """A Tenant an operator opened, and the founding admin who was invited to run it."""

    tenant_name: str
    slug: str
    email: str
    password: str
    full_name: str


async def an_admin(browser: AsyncClient, mailbox: Mailbox, label: str = "acme") -> FoundedTenant:
    """A signed-in founding admin of a Tenant of their own, opened and invited the way a real one
    is: nobody creates their own Tenant, so there is no endpoint a test can post to either. The
    operator's own service stands in for the operator, rather than signing one in first.
    """
    unique = uuid4().hex
    tenant = FoundedTenant(
        tenant_name="Acme Recruiting",
        slug=f"{label}-{unique}",
        email=f"{label}-admin-{unique}@example.com",
        password=DEFAULT_PASSWORD,
        full_name="Rana Khalil",
    )

    app = app_of(browser)
    async with app.state.database.session() as session:
        platform = PlatformService(
            session,
            app.state.authentication.gotrue,
            recruiter_portal_url=RECRUITER_PORTAL_URL,
        )
        await platform.create_tenant(
            name=tenant.tenant_name,
            slug=tenant.slug,
            email=tenant.email,
            full_name=tenant.full_name,
        )

    accepted = await accept_invite(browser, mailbox, tenant.email, password=tenant.password)
    assert accepted.status_code == 200, accepted.text
    return tenant


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
    await session.execute(update(Tenant).where(Tenant.slug == slug).values(is_active=is_active))
    await session.commit()
