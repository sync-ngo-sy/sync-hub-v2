from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.auth import ActingProfile, Authentication, AuthService, SessionCookies
from sync_api.candidates import ActingCandidate, CandidateProfileService, acting_candidate
from sync_api.cvs import CvService
from sync_api.jobs import JobBrowseService, JobService, Visitor, Visitors
from sync_api.notifications import NotificationService
from sync_api.problems import SEARCH_UNAVAILABLE_PROBLEM_TYPE, Problem
from sync_api.search import CandidateSearchService
from sync_api.tenants import ActingRecruiter, TenantService, acting_recruiter, require_admin
from sync_core import Database, Settings, Storage
from sync_rag import Embedder

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


def get_app_settings(request: Request) -> Settings:
    return cast("Settings", request.app.state.settings)


def get_database(request: Request) -> Database:
    return cast("Database", request.app.state.database)


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
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
    return await auth.acting_profile(cookies.read_access_token(request))


CurrentProfileDep = Annotated[ActingProfile, Depends(get_current_profile)]


async def get_acting_candidate(profile: CurrentProfileDep, session: SessionDep) -> ActingCandidate:
    return await acting_candidate(session, profile)


ActingCandidateDep = Annotated[ActingCandidate, Depends(get_acting_candidate)]


def get_candidate_profile_service(session: SessionDep) -> CandidateProfileService:
    return CandidateProfileService(session)


CandidateProfileServiceDep = Annotated[
    CandidateProfileService, Depends(get_candidate_profile_service)
]


def get_notification_service(session: SessionDep) -> NotificationService:
    return NotificationService(session)


NotificationServiceDep = Annotated[NotificationService, Depends(get_notification_service)]


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
    return await acting_recruiter(session, profile)


ActingRecruiterDep = Annotated[ActingRecruiter, Depends(get_acting_recruiter)]


def get_tenant_admin(recruiter: ActingRecruiterDep) -> ActingRecruiter:
    return require_admin(recruiter)


TenantAdminDep = Annotated[ActingRecruiter, Depends(get_tenant_admin)]


def get_job_service(session: SessionDep) -> JobService:
    return JobService(session)


JobServiceDep = Annotated[JobService, Depends(get_job_service)]


def get_job_browse_service(session: SessionDep) -> JobBrowseService:
    return JobBrowseService(session)


JobBrowseServiceDep = Annotated[JobBrowseService, Depends(get_job_browse_service)]


def get_visitors(settings: Annotated[Settings, Depends(get_app_settings)]) -> Visitors:
    return Visitors(settings)


def get_visitor(
    request: Request,
    response: Response,
    visitors: Annotated[Visitors, Depends(get_visitors)],
) -> Visitor:
    """Recognizes the browser reading a Job, and hands it back the cookie that says so."""
    visitor = visitors.of(request)
    visitors.remember(response, visitor)
    return visitor


VisitorDep = Annotated[Visitor, Depends(get_visitor)]


def get_embedder(request: Request) -> Embedder:
    embedder = cast("Embedder | None", request.app.state.embedder)
    if embedder is None:
        raise Problem(
            status=503,
            type=SEARCH_UNAVAILABLE_PROBLEM_TYPE,
            detail="Global search is not configured on this deployment.",
        )
    return embedder


def get_candidate_search_service(
    session: SessionDep, embedder: Annotated[Embedder, Depends(get_embedder)]
) -> CandidateSearchService:
    return CandidateSearchService(session, embedder)


CandidateSearchServiceDep = Annotated[CandidateSearchService, Depends(get_candidate_search_service)]
