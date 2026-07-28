from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, delete, select
from sqlalchemy.dialects.postgresql import insert

from sync_api.crm.access import reachable_candidate
from sync_api.crm.payload import PooledCandidate, TalentPoolPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_core import get_logger, transaction
from sync_core.models import Candidate, Profile, TalentPoolMember

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

#: One row of the pool: who they are now, and when this Tenant saved them.
type Member = tuple[UUID, str, str | None, str | None, datetime]


class TalentPoolService:
    """The one pool of Candidates a Tenant keeps warm — its own, and nobody else's."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def save(self, recruiter: ActingRecruiter, candidate_id: UUID) -> PooledCandidate:
        await reachable_candidate(self._db, recruiter.tenant.id, candidate_id)
        async with transaction(self._db):
            await self._db.execute(
                insert(TalentPoolMember)
                .values(
                    tenant_id=recruiter.tenant.id,
                    candidate_id=candidate_id,
                    added_by_recruiter_id=recruiter.profile.id,
                )
                # Keeps the first `added_at`: when a Tenant first saved someone is worth having.
                .on_conflict_do_nothing()
            )

        logger.info(
            "crm.candidate_pooled",
            candidate_id=str(candidate_id),
            tenant_id=str(recruiter.tenant.id),
        )
        pooled = await self._pooled(recruiter.tenant.id, candidate_id)
        if pooled is None:  # pragma: no cover — the row was just written in this transaction
            raise LookupError(f"no talent pool entry for {candidate_id}")
        return pooled

    async def page(
        self,
        recruiter: ActingRecruiter,
        *,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> TalentPoolPage:
        found = list(
            (
                await self._db.execute(
                    newest_first(
                        _members().where(TalentPoolMember.tenant_id == recruiter.tenant.id),
                        created_at=TalentPoolMember.added_at,
                        id_=TalentPoolMember.candidate_id,
                        cursor=cursor,
                        limit=limit,
                    )
                )
            ).tuples()
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return TalentPoolPage(items=[_as_payload(row) for row in rows], next_cursor=next_cursor)

    async def drop(self, recruiter: ActingRecruiter, candidate_id: UUID) -> None:
        await reachable_candidate(self._db, recruiter.tenant.id, candidate_id)
        async with transaction(self._db):
            await self._db.execute(
                delete(TalentPoolMember).where(
                    TalentPoolMember.tenant_id == recruiter.tenant.id,
                    TalentPoolMember.candidate_id == candidate_id,
                )
            )

        logger.info(
            "crm.candidate_unpooled",
            candidate_id=str(candidate_id),
            tenant_id=str(recruiter.tenant.id),
        )

    async def _pooled(self, tenant_id: UUID, candidate_id: UUID) -> PooledCandidate | None:
        found = (
            (
                await self._db.execute(
                    _members().where(
                        TalentPoolMember.tenant_id == tenant_id,
                        TalentPoolMember.candidate_id == candidate_id,
                    )
                )
            )
            .tuples()
            .first()
        )
        return None if found is None else _as_payload(found)


def _members() -> Select[Member]:
    return (
        select(
            TalentPoolMember.candidate_id,
            Profile.full_name,
            Candidate.headline,
            Candidate.location,
            TalentPoolMember.added_at,
        )
        .join(Candidate, Candidate.id == TalentPoolMember.candidate_id)
        .join(Profile, Profile.id == TalentPoolMember.candidate_id)
    )


def _cursor(row: Member) -> Cursor:
    candidate_id, _name, _headline, _location, added_at = row
    return Cursor(created_at=added_at, id=candidate_id)


def _as_payload(row: Member) -> PooledCandidate:
    candidate_id, full_name, headline, location, added_at = row
    return PooledCandidate(
        candidate_id=candidate_id,
        full_name=full_name,
        headline=headline,
        location=location,
        added_at=added_at,
    )
