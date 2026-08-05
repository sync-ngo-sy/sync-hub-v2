from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, literal, literal_column, select, text
from sqlalchemy.orm import aliased

from sync_core.discovery import DIRECTORY_PROFILES, SEARCH_PROFILES, narrowed_to, pooled_by
from sync_core.models import CandidateProfileChunk

if TYPE_CHECKING:
    from collections.abc import Sequence
    from typing import Any
    from uuid import UUID

    from sqlalchemy import ColumnElement, Select, SQLColumnExpression, Subquery
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.discovery import CandidateFilters
    from sync_rag.embedding import Embedder

#: The most Candidates one search reaches. Pages are offsets inside this depth: a cursor on
#: distance would have to re-enter the index traversal it came out of.
MAX_SEARCH_DEPTH: Final = 200

#: Chunks scanned per Candidate wanted. A profile is a handful of fragments and the closest
#: fragments of different people interleave, so this reaches the depth with room to spare.
CHUNKS_PER_CANDIDATE: Final = 10

#: Inlined, not bound: as a parameter it reaches the driver as a `regconfig` with no codec.
ENGLISH: Final[ColumnElement[str]] = literal_column("'english'")

#: pgvector applies a filter *after* the index gives it rows, so a selective one leaves a
#: handful of survivors and reads exactly like "no matches". `strict_order` widens the scan
#: until enough rows pass, keeping the exact ordering paging depends on.
WIDEN_THE_SCAN: Final = text("set local hnsw.iterative_scan = strict_order")


@dataclass(frozen=True, slots=True)
class CandidateMatch:
    candidate_id: UUID
    full_name: str | None
    avatar_url: str | None
    headline: str | None
    summary: str | None
    location_key: str | None
    location_name: str | None
    canonical_role_key: str | None
    canonical_role_name: str | None
    total_experience_years: int
    preferred_language_code: str | None
    in_talent_pool: bool
    chunk_type: str | None
    chunk_text: str


@dataclass(frozen=True, slots=True)
class RankedCandidates:
    matches: list[CandidateMatch]
    has_more: bool
    depth_reached: bool


class CandidateSearch:
    def __init__(
        self, session: AsyncSession, embedder: Embedder, *, depth: int = MAX_SEARCH_DEPTH
    ) -> None:
        self._db = session
        self._embedder = embedder
        self._depth = depth

    async def find(
        self,
        query: str,
        *,
        tenant_id: UUID,
        filters: CandidateFilters,
        keywords: str | None,
        limit: int,
        offset: int,
    ) -> RankedCandidates:
        wanted = min(offset + limit, self._depth)
        (embedded,) = await self._embedder.embed([query])
        await self._db.execute(WIDEN_THE_SCAN)
        found = (
            await self._db.execute(
                _page(
                    embedded,
                    tenant_id=tenant_id,
                    filters=filters,
                    keywords=keywords,
                    wanted=wanted,
                    offset=offset,
                )
            )
        ).all()
        rows = found[: max(wanted - offset, 0)]
        return RankedCandidates(
            matches=[_match(row) for row in rows],
            has_more=len(found) > len(rows),
            depth_reached=len(found) > len(rows) and wanted >= self._depth,
        )


def _match(row: Any) -> CandidateMatch:
    return CandidateMatch(
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
        chunk_type=row.chunk_type,
        chunk_text=row.chunk_text,
    )


def _page(
    embedded: Sequence[float],
    *,
    tenant_id: UUID,
    filters: CandidateFilters,
    keywords: str | None,
    wanted: int,
    offset: int,
) -> Select[tuple[Any, ...]]:
    reachable = _reachable(embedded, filters=filters, keywords=keywords, wanted=wanted)
    return (
        select(
            reachable.c.candidate_id,
            reachable.c.chunk_type,
            reachable.c.chunk_text,
            SEARCH_PROFILES.c.full_name,
            SEARCH_PROFILES.c.avatar_url,
            SEARCH_PROFILES.c.headline,
            SEARCH_PROFILES.c.summary,
            SEARCH_PROFILES.c.location_key,
            SEARCH_PROFILES.c.location_name,
            SEARCH_PROFILES.c.canonical_role_key,
            SEARCH_PROFILES.c.canonical_role_name,
            SEARCH_PROFILES.c.total_experience_years,
            SEARCH_PROFILES.c.preferred_language_code,
            pooled_by(reachable.c.candidate_id, tenant_id).label("in_talent_pool"),
        )
        .join_from(
            reachable,
            SEARCH_PROFILES,
            SEARCH_PROFILES.c.candidate_id == reachable.c.candidate_id,
        )
        .order_by(reachable.c.distance, reachable.c.candidate_id)
        .offset(offset)
    )


def _reachable(
    embedded: Sequence[float],
    *,
    filters: CandidateFilters,
    keywords: str | None,
    wanted: int,
) -> Subquery:
    distance = CandidateProfileChunk.embedding.cosine_distance(list(embedded)).label("distance")
    scanned = (
        select(
            CandidateProfileChunk.candidate_id,
            CandidateProfileChunk.chunk_type,
            CandidateProfileChunk.chunk_text,
            distance,
        )
        .where(
            _discoverable(CandidateProfileChunk.candidate_id, filters),
            *_mentioning(keywords),
        )
        .order_by(distance)
        .limit((wanted + 1) * CHUNKS_PER_CANDIDATE)
        .subquery("scanned")
    )
    best = (
        select(scanned)
        .distinct(scanned.c.candidate_id)
        .order_by(scanned.c.candidate_id, scanned.c.distance)
        .subquery("best")
    )
    return (
        select(best)
        .order_by(best.c.distance, best.c.candidate_id)
        .limit(wanted + 1)
        .subquery("reachable")
    )


def _discoverable(
    candidate_id: SQLColumnExpression[UUID], filters: CandidateFilters
) -> ColumnElement[bool]:
    """Eligibility and every filter, as a scalar subquery rather than a join.

    A join gives the planner a way in through the Candidate rather than the vector index, and it
    takes it — the whole query then computes a distance for every chunk of everyone who passes
    the filter. As a scalar subquery this cannot be pulled up, so it stays what pgvector expects:
    a filter applied to the rows the index scan has already ordered.

    The base projection, not the chunk-gated one: what makes this Global search rather than the
    directory is that it is scanning chunks at all, so a Candidate with none is already absent.
    """
    return (
        select(literal(1))
        .select_from(DIRECTORY_PROFILES)
        .where(
            DIRECTORY_PROFILES.c.candidate_id == candidate_id,
            *narrowed_to(DIRECTORY_PROFILES, filters),
        )
        .limit(1)
        .scalar_subquery()
        .is_not(None)
    )


def _mentioning(keywords: str | None) -> tuple[ColumnElement[bool], ...]:
    if not keywords:
        return ()
    mentioned = aliased(CandidateProfileChunk, name="mentioned")
    return (
        select(literal(1))
        .select_from(mentioned)
        .where(
            mentioned.candidate_id == CandidateProfileChunk.candidate_id,
            mentioned.search_vector.op("@@")(func.websearch_to_tsquery(ENGLISH, keywords)),
        )
        .limit(1)
        .scalar_subquery()
        .is_not(None),
    )
