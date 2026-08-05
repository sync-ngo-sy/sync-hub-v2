from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from sync_api.candidates.profile import CandidateProfileService
from sync_api.crm.access import reachable_candidate
from sync_api.discovery.payload import (
    CandidateDirectoryPage,
    CandidateRecord,
    DiscoveredCandidate,
)
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_core import get_logger
from sync_core.discovery import DIRECTORY_PROFILES, narrowed_to, pooled_by
from sync_core.models import Candidate, CanonicalRole, Location, Profile, User

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_core.discovery import CandidateFilters

logger = get_logger(__name__)


class CandidateDirectoryService:
    """Searchable Candidates asked for by fact rather than by meaning."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._profiles = CandidateProfileService(session)

    async def page(
        self,
        recruiter: ActingRecruiter,
        *,
        filters: CandidateFilters,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> CandidateDirectoryPage:
        listed = select(
            DIRECTORY_PROFILES.c.candidate_id,
            DIRECTORY_PROFILES.c.created_at,
            DIRECTORY_PROFILES.c.full_name,
            DIRECTORY_PROFILES.c.avatar_url,
            DIRECTORY_PROFILES.c.headline,
            DIRECTORY_PROFILES.c.summary,
            DIRECTORY_PROFILES.c.location_key,
            DIRECTORY_PROFILES.c.location_name,
            DIRECTORY_PROFILES.c.canonical_role_key,
            DIRECTORY_PROFILES.c.canonical_role_name,
            DIRECTORY_PROFILES.c.total_experience_years,
            DIRECTORY_PROFILES.c.preferred_language_code,
            pooled_by(DIRECTORY_PROFILES.c.candidate_id, recruiter.tenant.id).label(
                "in_talent_pool"
            ),
        ).where(*narrowed_to(DIRECTORY_PROFILES, filters))
        found = (
            await self._db.execute(
                newest_first(
                    listed,
                    created_at=DIRECTORY_PROFILES.c.created_at,
                    id_=DIRECTORY_PROFILES.c.candidate_id,
                    cursor=cursor,
                    limit=limit,
                )
            )
        ).all()
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        logger.info("discovery.directory_listed", results=len(rows))
        return CandidateDirectoryPage(items=[_listed(row) for row in rows], next_cursor=next_cursor)

    async def record(self, recruiter: ActingRecruiter, candidate_id: UUID) -> CandidateRecord:
        """The whole profile, phone and email included, behind the same reach guard the CRM uses.

        A Candidate the Tenant cannot reach is indistinguishable from one that does not exist.
        """
        await reachable_candidate(self._db, recruiter.tenant.id, candidate_id)
        profile = await self._profiles.profile(candidate_id)
        found = (
            await self._db.execute(
                select(
                    Profile.avatar_url,
                    Location.name.label("location_name"),
                    CanonicalRole.name.label("canonical_role_name"),
                    User.email,
                    pooled_by(Candidate.id, recruiter.tenant.id).label("in_talent_pool"),
                )
                .join_from(Candidate, Profile, Profile.id == Candidate.id)
                .outerjoin(Location, Location.key == Candidate.location_key)
                .outerjoin(CanonicalRole, CanonicalRole.key == Candidate.canonical_role_key)
                .outerjoin(User, User.id == Candidate.id)
                .where(Candidate.id == candidate_id)
            )
        ).one()
        return CandidateRecord(
            candidate_id=candidate_id,
            full_name=profile.full_name,
            avatar_url=found.avatar_url,
            headline=profile.headline,
            summary=profile.summary,
            location_key=profile.location_key,
            location_name=found.location_name,
            canonical_role_key=profile.canonical_role_key,
            canonical_role_name=found.canonical_role_name,
            total_experience_years=profile.total_experience_years,
            preferred_language_code=profile.preferred_language_code,
            in_talent_pool=found.in_talent_pool,
            phone=profile.phone,
            email=found.email,
            experiences=profile.experiences,
            educations=profile.educations,
            skills=profile.skills,
            languages=profile.languages,
            projects=profile.projects,
        )


def _cursor(row: Any) -> Cursor:
    return Cursor(created_at=row.created_at, id=row.candidate_id)


def _listed(row: Any) -> DiscoveredCandidate:
    return DiscoveredCandidate(
        candidate_id=row.candidate_id,
        full_name=row.full_name,
        avatar_url=row.avatar_url,
        headline=row.headline,
        summary=row.summary,
        location_key=row.location_key,
        location_name=row.location_name,
        canonical_role_key=row.canonical_role_key,
        canonical_role_name=row.canonical_role_name,
        total_experience_years=row.total_experience_years,
        preferred_language_code=row.preferred_language_code,
        in_talent_pool=row.in_talent_pool,
    )
