"""What a route asks for and the app supplies."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ActingProfile, Authentication, AuthService, SessionCookies
from sync_api.candidates import ActingCandidate, CandidateProfileService, acting_candidate
from sync_api.cvs import CvService
from sync_api.tenants import ActingRecruiter, TenantService, acting_recruiter, require_admin
from sync_core import Database, Settings, Storage

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


def get_app_settings(request: Request) -> Settings:
    """The settings *this* app was built with — not `sync_core.get_settings()`.

    They differ: the process-wide ones are read from the environment once and cached, while
    `create_app` may have been handed a modified copy, which is how a test stands an app up
    with a rate limit it can reach or a database it cannot.
    """
    return cast("Settings", request.app.state.settings)


def get_database(request: Request) -> Database:
    return cast("Database", request.app.state.database)


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    """A session for the duration of one request. Routes commit their own work."""
    async with database.session() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


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


async def get_acting_candidate(profile: CurrentProfileDep, session: SessionDep) -> ActingCandidate:
    """The caller as a Candidate, or a 403.

    Depend on this from every route that touches a candidate's own data: it establishes
    whose data that is, so no route ever takes a candidate id from the client.
    """
    return await acting_candidate(session, profile)


ActingCandidateDep = Annotated[ActingCandidate, Depends(get_acting_candidate)]


def get_candidate_profile_service(session: SessionDep) -> CandidateProfileService:
    return CandidateProfileService(session)


CandidateProfileServiceDep = Annotated[
    CandidateProfileService, Depends(get_candidate_profile_service)
]


def get_storage(request: Request) -> Storage:
    return cast("Storage", request.app.state.storage)


def get_cv_service(
    session: SessionDep,
    storage: Annotated[Storage, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> CvService:
    return CvService(session, storage, settings)


CvServiceDep = Annotated[CvService, Depends(get_cv_service)]


def get_tenant_service(
    session: SessionDep,
    authentication: Annotated[Authentication, Depends(get_authentication)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> TenantService:
    return TenantService(
        session,
        authentication.gotrue,
        invite_redirect_url=str(settings.recruiter_portal_url).rstrip("/"),
    )


TenantServiceDep = Annotated[TenantService, Depends(get_tenant_service)]


async def get_acting_recruiter(profile: CurrentProfileDep, session: SessionDep) -> ActingRecruiter:
    """The caller's standing inside their Tenant, or a 403.

    Depend on this from every tenant-scoped route: it is the single place the Recruiter and
    Tenant kill-switches are read, so no route can be written that forgets one.
    """
    return await acting_recruiter(session, profile)


ActingRecruiterDep = Annotated[ActingRecruiter, Depends(get_acting_recruiter)]


def get_tenant_admin(recruiter: ActingRecruiterDep) -> ActingRecruiter:
    return require_admin(recruiter)


TenantAdminDep = Annotated[ActingRecruiter, Depends(get_tenant_admin)]
