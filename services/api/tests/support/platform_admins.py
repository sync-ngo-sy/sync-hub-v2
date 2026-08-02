from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import uuid4

from sync_api.dependencies import PlatformAdminDep
from sync_api.platform import create_platform_admin
from tests.support.candidates import DEFAULT_PASSWORD, Signup, sign_in

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

#: A route that is nothing but the guard, mounted only by the module that tests the guard alone.
PROBE = "/v1/platform/probe"

TENANTS = "/v1/platform/tenants"
OVERVIEW = "/v1/platform/overview"


def mount_the_probe(app: FastAPI) -> None:
    @app.get(PROBE)
    async def probe(admin: PlatformAdminDep) -> dict[str, str]:
        return {"id": str(admin.id)}


def a_platform_admin_signup(label: str = "operator") -> Signup:
    return Signup(
        email=f"{label}-{uuid4().hex}@example.com",
        password=DEFAULT_PASSWORD,
        full_name="Nour Sabbagh",
    )


async def a_platform_admin(app: FastAPI, session: AsyncSession, label: str = "operator") -> Signup:
    """Made the way the bootstrap script makes one, so the tests cover that path too."""
    signup = a_platform_admin_signup(label)
    await create_platform_admin(
        session,
        app.state.authentication.gotrue,
        email=signup.email,
        password=signup.password,
        full_name=signup.full_name,
    )
    return signup


async def a_signed_in_platform_admin(
    app: FastAPI, browser: AsyncClient, session: AsyncSession, label: str = "operator"
) -> Signup:
    signup = await a_platform_admin(app, session, label)
    signed_in = await sign_in(browser, signup)
    assert signed_in.status_code == 200, signed_in.text
    return signup


@dataclass(frozen=True, slots=True)
class NewTenant:
    """What a Platform admin types to open a Tenant: no password, the founder picks their own."""

    name: str
    slug: str
    email: str
    full_name: str


def a_new_tenant(label: str = "acme", *, slug: str | None = None) -> NewTenant:
    unique = uuid4().hex
    return NewTenant(
        name="Acme Recruiting",
        slug=slug if slug is not None else f"{label}-{unique}",
        email=f"{label}-founder-{unique}@example.com",
        full_name="Rana Khalil",
    )


async def list_tenants(browser: AsyncClient) -> Response:
    return await browser.get(TENANTS)


async def create_tenant(browser: AsyncClient, tenant: NewTenant) -> Response:
    return await browser.post(
        TENANTS,
        json={
            "name": tenant.name,
            "slug": tenant.slug,
            "email": tenant.email,
            "full_name": tenant.full_name,
        },
    )


async def resend_invite(browser: AsyncClient, tenant_id: str) -> Response:
    return await browser.post(f"{TENANTS}/{tenant_id}/invite")


async def set_tenant_status(browser: AsyncClient, tenant_id: str, *, is_active: bool) -> Response:
    return await browser.patch(f"{TENANTS}/{tenant_id}", json={"is_active": is_active})


async def read_overview(browser: AsyncClient) -> Response:
    return await browser.get(OVERVIEW)
