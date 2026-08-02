from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from sync_api.dependencies import PlatformAdminDep
from sync_api.platform import create_platform_admin
from tests.support.candidates import DEFAULT_PASSWORD, Signup, sign_in

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

#: A route that is nothing but the guard. #146 brings the Platform admin's real operations.
PROBE = "/v1/platform/probe"


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
