from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final, cast
from uuid import UUID

from sqlalchemy import Select, delete, or_, select
from sqlalchemy.dialects.postgresql import insert

from sync_api.crm.access import reachable_candidate
from sync_api.crm.payload import PooledCandidate, Tag, TalentPoolPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Ordering, SortCursor, ordered_by, page_of
from sync_core import get_logger, transaction
from sync_core.models import (
    Candidate,
    CandidateTagAssignment,
    CanonicalRole,
    Location,
    Profile,
    TalentPoolMember,
    TenantTag,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy import ColumnElement
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

#: Left-joined, so a Candidate who has chosen no Location has no name here — which the column
#: itself, `not null` on its own table, has no way to say. The same for a Canonical role.
LOCATION_NAME: Final = cast("ColumnElement[str | None]", Location.name)

CANONICAL_ROLE_NAME: Final = cast("ColumnElement[str | None]", CanonicalRole.name)

#: `LIKE`'s own way of saying that the character after it is only a character.
_ESCAPE: Final = "\\"


class TalentPoolOrder(StrEnum):
    """How the pool has been asked to order itself. Each value names the answer it gives rather
    than a column and a direction, so there is no ascending/descending convention to learn — and
    no way to ask for an order the pool cannot page through."""

    NEWEST = "newest"
    OLDEST = "oldest"
    NAME = "name"
    NAME_REVERSED = "name_reversed"


def _saved(row: Any) -> str:
    return row.added_at.isoformat()


def _name(row: Any) -> str:
    return row.full_name


ORDERINGS: Final[dict[TalentPoolOrder, Ordering]] = {
    TalentPoolOrder.NEWEST: Ordering(
        TalentPoolMember.added_at, True, datetime.fromisoformat, _saved
    ),
    TalentPoolOrder.OLDEST: Ordering(
        TalentPoolMember.added_at, False, datetime.fromisoformat, _saved
    ),
    TalentPoolOrder.NAME: Ordering(Profile.full_name, False, str, _name),
    TalentPoolOrder.NAME_REVERSED: Ordering(Profile.full_name, True, str, _name),
}


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
        wanted: str | None = None,
        order: TalentPoolOrder = TalentPoolOrder.NEWEST,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> TalentPoolPage:
        sorting = ORDERINGS[order]
        found = (
            await self._db.execute(
                ordered_by(
                    _members().where(
                        TalentPoolMember.tenant_id == recruiter.tenant.id, *_matching(wanted)
                    ),
                    key=sorting.column,
                    id_=TalentPoolMember.candidate_id,
                    descending=sorting.descending,
                    read=sorting.read,
                    cursor=cursor,
                    limit=limit,
                )
            )
        ).all()
        rows, next_cursor = page_of(found, limit=limit, cursor_for=lambda row: _cursor(order, row))
        filed = await self._filing(recruiter.tenant.id, _ids(rows))
        logger.info("crm.talent_pool_listed", order=order.value, results=len(rows))
        return TalentPoolPage(
            items=[_as_payload(row, filed) for row in rows], next_cursor=next_cursor
        )

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
            await self._db.execute(
                _members().where(
                    TalentPoolMember.tenant_id == tenant_id,
                    TalentPoolMember.candidate_id == candidate_id,
                )
            )
        ).first()
        if found is None:
            return None
        return _as_payload(found, await self._filing(tenant_id, [candidate_id]))

    async def _filing(self, tenant_id: UUID, candidate_ids: list[UUID]) -> dict[UUID, list[Tag]]:
        """Every Tag this Tenant has put on the page's Candidates, in one read rather than one
        read a row."""
        if not candidate_ids:
            return {}
        rows = (
            await self._db.execute(
                select(CandidateTagAssignment.candidate_id, TenantTag)
                .join(TenantTag, TenantTag.id == CandidateTagAssignment.tag_id)
                .where(
                    CandidateTagAssignment.tenant_id == tenant_id,
                    CandidateTagAssignment.candidate_id.in_(candidate_ids),
                )
                .order_by(TenantTag.name)
            )
        ).tuples()
        filed: dict[UUID, list[Tag]] = defaultdict(list)
        for candidate_id, tag in rows:
            filed[candidate_id].append(Tag.of(tag))
        return filed


def _members() -> Select[Any]:
    return (
        select(
            TalentPoolMember.candidate_id,
            Profile.full_name,
            Profile.avatar_url,
            Candidate.headline,
            LOCATION_NAME.label("location_name"),
            CANONICAL_ROLE_NAME.label("canonical_role_name"),
            Candidate.total_experience_years,
            TalentPoolMember.added_at,
        )
        .join(Candidate, Candidate.id == TalentPoolMember.candidate_id)
        .join(Profile, Profile.id == TalentPoolMember.candidate_id)
        .outerjoin(Location, Location.key == Candidate.location_key)
        .outerjoin(CanonicalRole, CanonicalRole.key == Candidate.canonical_role_key)
    )


def _matching(wanted: str | None) -> list[ColumnElement[bool]]:
    """Whoever reads as holding the words somewhere in their name or their headline.

    A headline nobody wrote is null, and null never matches — which is what keeps a search from
    quietly answering with the people it knows least about.
    """
    written = (wanted or "").strip()
    if not written:
        return []
    anywhere = f"%{_literally(written)}%"
    return [
        or_(
            Profile.full_name.ilike(anywhere, escape=_ESCAPE),
            Candidate.headline.ilike(anywhere, escape=_ESCAPE),
        )
    ]


def _literally(written: str) -> str:
    """`%` and `_` are `LIKE`'s own wildcards; somebody searching for them means the characters."""
    for character in (_ESCAPE, "%", "_"):
        written = written.replace(character, _ESCAPE + character)
    return written


def _ids(rows: Sequence[Any]) -> list[UUID]:
    return [row.candidate_id for row in rows]


def _cursor(order: TalentPoolOrder, row: Any) -> SortCursor:
    return SortCursor(at=ORDERINGS[order].wrote(row), id=row.candidate_id)


def _as_payload(row: Any, filed: dict[UUID, list[Tag]]) -> PooledCandidate:
    return PooledCandidate(
        candidate_id=row.candidate_id,
        full_name=row.full_name,
        avatar_url=row.avatar_url,
        headline=row.headline,
        location_name=row.location_name,
        canonical_role_name=row.canonical_role_name,
        total_experience_years=row.total_experience_years,
        tags=filed.get(row.candidate_id, []),
        added_at=row.added_at,
    )
