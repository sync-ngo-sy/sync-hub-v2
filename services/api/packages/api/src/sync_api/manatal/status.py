from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final, cast

from sqlalchemy import Select, String, func, select
from sqlalchemy import cast as sql_cast

from sync_api.manatal.payload import ManatalMigrationCounts, ManatalMigrationRecent, ManatalMigrationStatus
from sync_core.models import Candidate, Cv, CvParsingStatus, Profile, TalentPoolMember, User

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter

RECENT_LIMIT: Final = 20

LAST_SIGN_IN = cast("Any", User.last_sign_in_at)


class ManatalMigrationService:
    """Read-only progress for candidates a Tenant brought across from Manatal."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def status(self, recruiter: ActingRecruiter) -> ManatalMigrationStatus:
        tenant_id = recruiter.tenant.id
        counts = (await self._db.execute(_counts(tenant_id))).mappings().one()
        recent = (await self._db.execute(_recent(tenant_id))).mappings().all()
        return ManatalMigrationStatus(
            counts=ManatalMigrationCounts(
                total=counts["total"],
                published=counts["published"],
                complete=counts["complete"],
                unclaimed=counts["unclaimed"],
                awaiting_parse=counts["awaiting_parse"],
                parse_failed=counts["parse_failed"],
                with_linkedin=counts["with_linkedin"],
            ),
            recent=[
                ManatalMigrationRecent(
                    candidate_id=str(row["candidate_id"]),
                    full_name=row["full_name"],
                    email=row["email"],
                    is_claimed=row["is_claimed"],
                    is_searchable=row["is_searchable"],
                    parsing_status=row["parsing_status"],
                    saved_at=row["saved_at"].isoformat(),
                )
                for row in recent
            ],
        )


def _imported_in_pool(tenant_id: UUID) -> Select[Any]:
    return (
        select(
            Candidate.id.label("candidate_id"),
            Profile.full_name,
            User.email,
            Candidate.is_searchable,
            Candidate.linkedin_url,
            Candidate.profile_completed_at,
            sql_cast(Cv.parsing_status, String).label("parsing_status"),
            TalentPoolMember.added_at.label("saved_at"),
            LAST_SIGN_IN.is_not(None).label("is_claimed"),
        )
        .select_from(TalentPoolMember)
        .join(Candidate, Candidate.id == TalentPoolMember.candidate_id)
        .join(Profile, Profile.id == Candidate.id)
        .join(User, User.id == Candidate.id)
        .outerjoin(Cv, Cv.id == Candidate.current_cv_id)
        .where(
            TalentPoolMember.tenant_id == tenant_id,
            Candidate.is_imported_from_manatal.is_(True),
        )
    )


def _counts(tenant_id: UUID) -> Select[Any]:
    imported = _imported_in_pool(tenant_id).subquery()
    return select(
        func.count().label("total"),
        func.count().filter(imported.c.is_searchable.is_(True)).label("published"),
        func.count().filter(imported.c.profile_completed_at.is_not(None)).label("complete"),
        func.count().filter(imported.c.is_claimed.is_(False)).label("unclaimed"),
        func.count()
        .filter(
            imported.c.parsing_status.is_(None)
            | (imported.c.parsing_status != CvParsingStatus.READY)
        )
        .label("awaiting_parse"),
        func.count()
        .filter(imported.c.parsing_status == CvParsingStatus.FAILED)
        .label("parse_failed"),
        func.count().filter(imported.c.linkedin_url.is_not(None)).label("with_linkedin"),
    ).select_from(imported)


def _recent(tenant_id: UUID) -> Select[Any]:
    imported = _imported_in_pool(tenant_id).subquery()
    return (
        select(
            imported.c.candidate_id,
            imported.c.full_name,
            imported.c.email,
            imported.c.is_claimed,
            imported.c.is_searchable,
            imported.c.parsing_status,
            imported.c.saved_at,
        )
        .select_from(imported)
        .order_by(imported.c.saved_at.desc())
        .limit(RECENT_LIMIT)
    )
