from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from sync_api.candidate_directory.payload import (
    CandidateDirectoryPage,
    CandidateRecord,
    SearchableCandidate,
)
from sync_api.candidates.profile import CandidateProfileService
from sync_api.crm.access import reachable_candidate
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_core import get_logger
from sync_core.models import (
    Candidate,
    CandidateLanguage,
    CanonicalRole,
    Language,
    Location,
    Profile,
    User,
)
from sync_core.searchable import DIRECTORY_PROFILES, narrowed_to, pooled_by

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_core.searchable import CandidateFilters

logger = get_logger(__name__)


class CandidateDirectoryService:
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
            *DIRECTORY_PROFILES.c,
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
        logger.info("directory.candidates_listed", results=len(rows))
        return CandidateDirectoryPage(
            items=[SearchableCandidate.of(row) for row in rows], next_cursor=next_cursor
        )

    async def record(self, recruiter: ActingRecruiter, candidate_id: UUID) -> CandidateRecord:
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
            language_names=await self._language_names(candidate_id),
            in_talent_pool=found.in_talent_pool,
            phone=profile.phone,
            email=found.email,
            experiences=profile.experiences,
            educations=profile.educations,
            skills=profile.skills,
            languages=profile.languages,
            projects=profile.projects,
        )

    async def _language_names(self, candidate_id: UUID) -> list[str]:
        """Read here rather than off the directory view, which only holds Searchable Candidates —
        a Candidate reachable through the Talent pool alone is not in it."""
        rows = await self._db.scalars(
            select(Language.name)
            .join_from(
                CandidateLanguage, Language, Language.code == CandidateLanguage.language_code
            )
            .where(CandidateLanguage.candidate_id == candidate_id)
            .order_by(CandidateLanguage.sort_order, Language.name)
        )
        return list(rows)


def _cursor(row: Any) -> Cursor:
    return Cursor(created_at=row.created_at, id=row.candidate_id)
