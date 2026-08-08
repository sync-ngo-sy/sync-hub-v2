from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Final, cast
from uuid import UUID

from sqlalchemy import Select, delete, select
from sqlalchemy.dialects.postgresql import insert

from sync_api.crm.access import reachable_candidate
from sync_api.crm.payload import PooledCandidate, TalentPoolPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_core import get_logger, transaction
from sync_core.models import Candidate, Location, Profile, TalentPoolMember, User

if TYPE_CHECKING:
    from sqlalchemy import ColumnElement
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

#: One row of the pool: who they are now, when this Tenant saved them, and how they
#: came to exist at all.
type Member = tuple[UUID, str, str | None, str | None, datetime, bool, datetime | None]

#: Left-joined, so a Candidate who has chosen no Location has no name here — which the column
#: itself, `not null` on its own table, has no way to say.
LOCATION_NAME: Final = cast("ColumnElement[str | None]", Location.name)

#: Whether anybody has ever signed into the account. `auth.users` is the only thing
#: that knows, and asking it is what keeps "claimed" from being a column somebody has
#: to remember to write.
LAST_SIGN_IN: Final = cast("ColumnElement[datetime | None]", User.last_sign_in_at)


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
            LOCATION_NAME,
            TalentPoolMember.added_at,
            Candidate.is_imported_from_manatal,
            LAST_SIGN_IN,
        )
        .join(Candidate, Candidate.id == TalentPoolMember.candidate_id)
        .join(Profile, Profile.id == TalentPoolMember.candidate_id)
        .join(User, User.id == TalentPoolMember.candidate_id)
        .outerjoin(Location, Location.key == Candidate.location_key)
    )


def _cursor(row: Member) -> Cursor:
    candidate_id, _name, _headline, _location_name, added_at, _imported, _signed_in = row
    return Cursor(created_at=added_at, id=candidate_id)


def _as_payload(row: Member) -> PooledCandidate:
    candidate_id, full_name, headline, location_name, added_at, imported, signed_in = row
    return PooledCandidate(
        candidate_id=candidate_id,
        full_name=full_name,
        headline=headline,
        location_name=location_name,
        added_at=added_at,
        is_imported_from_manatal=imported,
        is_claimed=signed_in is not None,
    )
