from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.access_requests import AccessRequestService
from sync_api.applications import (
    ApplicationReviewService,
    ApplicationService,
    MatchAssessmentService,
)
from sync_api.auth import ActingProfile, Authentication, AuthService, SessionCookies
from sync_api.candidates import (
    ActingCandidate,
    CandidateDeletion,
    CandidateProfileService,
    acting_candidate,
)
from sync_api.crm import (
    ABOUT_APPLICATIONS,
    ABOUT_CANDIDATES,
    ON_APPLICATIONS,
    ON_CANDIDATES,
    NoteService,
    TagAssignmentService,
    TagService,
    TalentPoolService,
)
from sync_api.cvs import CvService
from sync_api.discovery import CandidateDirectoryService
from sync_api.jobs import JobBrowseService, JobService, TrackedLinkService, Visitor, Visitors
from sync_api.messaging import MessageTemplateService, OutreachService
from sync_api.notifications import NotificationService
from sync_api.platform import ActingPlatformAdmin, PlatformService, acting_platform_admin
from sync_api.problems import SEARCH_UNAVAILABLE_PROBLEM_TYPE, Problem
from sync_api.search import CandidateSearchService
from sync_api.stats import StatsService
from sync_api.tenants import ActingRecruiter, TenantService, acting_recruiter, require_admin
from sync_assessments import MatchAssessor
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
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AuthService:
    return AuthService(
        session,
        authentication.gotrue,
        authentication.verifier,
        recruiter_portal_url=str(settings.recruiter_portal_url).rstrip("/"),
        admin_portal_url=str(settings.admin_portal_url).rstrip("/"),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_profile(
    request: Request,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
) -> ActingProfile:
    return await auth.acting_profile(cookies.read_access_token(request))


CurrentProfileDep = Annotated[ActingProfile, Depends(get_current_profile)]


def get_acting_candidate(profile: CurrentProfileDep) -> ActingCandidate:
    return acting_candidate(profile)


ActingCandidateDep = Annotated[ActingCandidate, Depends(get_acting_candidate)]


def get_candidate_profile_service(session: SessionDep) -> CandidateProfileService:
    return CandidateProfileService(session)


CandidateProfileServiceDep = Annotated[
    CandidateProfileService, Depends(get_candidate_profile_service)
]


def get_candidate_directory_service(session: SessionDep) -> CandidateDirectoryService:
    return CandidateDirectoryService(session)


CandidateDirectoryServiceDep = Annotated[
    CandidateDirectoryService, Depends(get_candidate_directory_service)
]


def get_candidate_deletion(
    session: SessionDep,
    authentication: Annotated[Authentication, Depends(get_authentication)],
) -> CandidateDeletion:
    return CandidateDeletion(session, authentication.gotrue)


CandidateDeletionDep = Annotated[CandidateDeletion, Depends(get_candidate_deletion)]


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
        recruiter_portal_url=str(settings.recruiter_portal_url).rstrip("/"),
    )


TenantServiceDep = Annotated[TenantService, Depends(get_tenant_service)]


def get_acting_recruiter(profile: CurrentProfileDep) -> ActingRecruiter:
    return acting_recruiter(profile)


ActingRecruiterDep = Annotated[ActingRecruiter, Depends(get_acting_recruiter)]


def get_acting_platform_admin(profile: CurrentProfileDep) -> ActingPlatformAdmin:
    return acting_platform_admin(profile)


PlatformAdminDep = Annotated[ActingPlatformAdmin, Depends(get_acting_platform_admin)]


def get_platform_service(
    session: SessionDep,
    authentication: Annotated[Authentication, Depends(get_authentication)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PlatformService:
    return PlatformService(
        session,
        authentication.gotrue,
        recruiter_portal_url=str(settings.recruiter_portal_url).rstrip("/"),
    )


PlatformServiceDep = Annotated[PlatformService, Depends(get_platform_service)]


def get_access_request_service(
    platform: PlatformServiceDep, session: SessionDep
) -> AccessRequestService:
    """Converting a request opens a Tenant, so the queue is built on the same service the
    Platform admin opens one by hand with — one way to make a Tenant, not two."""
    return AccessRequestService(session, platform)


AccessRequestServiceDep = Annotated[AccessRequestService, Depends(get_access_request_service)]


def get_tenant_admin(recruiter: ActingRecruiterDep) -> ActingRecruiter:
    return require_admin(recruiter)


TenantAdminDep = Annotated[ActingRecruiter, Depends(get_tenant_admin)]


def get_tag_service(session: SessionDep) -> TagService:
    return TagService(session)


TagServiceDep = Annotated[TagService, Depends(get_tag_service)]


def get_application_tags(session: SessionDep) -> TagAssignmentService:
    return TagAssignmentService(session, ON_APPLICATIONS)


ApplicationTagsDep = Annotated[TagAssignmentService, Depends(get_application_tags)]


def get_candidate_tags(session: SessionDep) -> TagAssignmentService:
    return TagAssignmentService(session, ON_CANDIDATES)


CandidateTagsDep = Annotated[TagAssignmentService, Depends(get_candidate_tags)]


def get_application_notes(session: SessionDep) -> NoteService:
    return NoteService(session, ABOUT_APPLICATIONS)


ApplicationNotesDep = Annotated[NoteService, Depends(get_application_notes)]


def get_candidate_notes(session: SessionDep) -> NoteService:
    return NoteService(session, ABOUT_CANDIDATES)


CandidateNotesDep = Annotated[NoteService, Depends(get_candidate_notes)]


def get_message_template_service(session: SessionDep) -> MessageTemplateService:
    return MessageTemplateService(session)


MessageTemplateServiceDep = Annotated[MessageTemplateService, Depends(get_message_template_service)]


def get_outreach_service(session: SessionDep) -> OutreachService:
    return OutreachService(session)


OutreachServiceDep = Annotated[OutreachService, Depends(get_outreach_service)]


def get_talent_pool_service(session: SessionDep) -> TalentPoolService:
    return TalentPoolService(session)


TalentPoolServiceDep = Annotated[TalentPoolService, Depends(get_talent_pool_service)]


def get_job_service(session: SessionDep) -> JobService:
    return JobService(session)


JobServiceDep = Annotated[JobService, Depends(get_job_service)]


def get_job_browse_service(session: SessionDep) -> JobBrowseService:
    return JobBrowseService(session)


JobBrowseServiceDep = Annotated[JobBrowseService, Depends(get_job_browse_service)]


def get_tracked_link_service(session: SessionDep) -> TrackedLinkService:
    return TrackedLinkService(session)


TrackedLinkServiceDep = Annotated[TrackedLinkService, Depends(get_tracked_link_service)]


def get_stats_service(session: SessionDep) -> StatsService:
    return StatsService(session)


StatsServiceDep = Annotated[StatsService, Depends(get_stats_service)]


def get_visitors(settings: Annotated[Settings, Depends(get_app_settings)]) -> Visitors:
    return Visitors(settings)


def get_visitor(
    request: Request,
    response: Response,
    visitors: Annotated[Visitors, Depends(get_visitors)],
) -> Visitor:
    """Recognizes the browser reading a Job, and hands it back the cookie that says so."""
    visitor = visitors.recognize(request)
    visitors.remember(response, visitor)
    return visitor


VisitorDep = Annotated[Visitor, Depends(get_visitor)]


def get_application_service(session: SessionDep) -> ApplicationService:
    return ApplicationService(session)


ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]


def get_application_review_service(
    session: SessionDep,
    storage: Annotated[Storage, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ApplicationReviewService:
    return ApplicationReviewService(session, storage, settings)


ApplicationReviewServiceDep = Annotated[
    ApplicationReviewService, Depends(get_application_review_service)
]


def get_assessor(request: Request) -> MatchAssessor | None:
    """None where the deployment has no model configured. The service is what refuses to
    assess without one, so an Application's assessment history stays readable regardless."""
    return cast("MatchAssessor | None", request.app.state.assessor)


def get_match_assessment_service(
    session: SessionDep, assessor: Annotated[MatchAssessor | None, Depends(get_assessor)]
) -> MatchAssessmentService:
    return MatchAssessmentService(session, assessor)


MatchAssessmentServiceDep = Annotated[MatchAssessmentService, Depends(get_match_assessment_service)]


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
