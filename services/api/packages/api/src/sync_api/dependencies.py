"""What a route asks for and the app supplies."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ActingProfile, Authentication, AuthService, SessionCookies
from sync_api.tenants import ActingRecruiter, TenantService
from sync_core import Database, Settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


def get_database(request: Request) -> Database:
    return cast("Database", request.app.state.database)


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    """A session for the duration of one request. Routes commit their own work."""
    async with database.session() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_app_settings(request: Request) -> Settings:
    return cast("Settings", request.app.state.settings)


SettingsDep = Annotated[Settings, Depends(get_app_settings)]


def get_authentication(request: Request) -> Authentication:
    return cast("Authentication", request.app.state.authentication)


def get_session_cookies(
    authentication: Annotated[Authentication, Depends(get_authentication)],
) -> SessionCookies:
    return authentication.cookies


SessionCookiesDep = Annotated[SessionCookies, Depends(get_session_cookies)]


def get_auth_service(
    session: SessionDep,
    authentication: Annotated[Authentication, Depends(get_authentication)],
) -> AuthService:
    return AuthService(session, authentication.gotrue, authentication.verifier)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_profile(
    request: Request,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
) -> ActingProfile:
    """The Profile behind the session cookie, or a 401.

    Depend on this from any route that needs to know who is asking — it is the way in.
    ADR-0002 moved every ownership and tenant check into the API, and they all start here.
    """
    return await auth.acting_profile(cookies.read_access_token(request))


CurrentProfileDep = Annotated[ActingProfile, Depends(get_current_profile)]


def get_tenant_service(
    session: SessionDep,
    authentication: Annotated[Authentication, Depends(get_authentication)],
    settings: SettingsDep,
) -> TenantService:
    return TenantService(
        session,
        authentication.gotrue,
        # `AnyHttpUrl` normalizes in a trailing slash pydantic adds and GoTrue's redirect
        # allow-list, an exact string match, does not — the same reason `Settings.gotrue_url`
        # strips it.
        recruiter_portal_url=str(settings.recruiter_portal_url).rstrip("/"),
    )


TenantServiceDep = Annotated[TenantService, Depends(get_tenant_service)]


async def get_acting_recruiter(
    profile: CurrentProfileDep, tenants: TenantServiceDep
) -> ActingRecruiter:
    """The Recruiter behind the session cookie, or a 403.

    Depend on this from any tenant-scoped route (invite, role/activation management, and
    whatever future tickets add) — it is where the kill-switch and per-Recruiter
    deactivation both get enforced.
    """
    return await tenants.load_acting_recruiter(profile)


ActingRecruiterDep = Annotated[ActingRecruiter, Depends(get_acting_recruiter)]
