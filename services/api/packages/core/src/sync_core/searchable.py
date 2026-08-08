from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sqlalchemy import DateTime, Integer, Text, Uuid, column, select, table

from sync_core.models import CandidateLanguage, CandidateSkill, TalentPoolMember

if TYPE_CHECKING:
    from decimal import Decimal
    from uuid import UUID

    from sqlalchemy import ColumnElement, SQLColumnExpression
    from sqlalchemy.sql import TableClause


def _eligible(view: str) -> TableClause:
    return table(
        view,
        column("candidate_id", Uuid),
        column("created_at", DateTime(timezone=True)),
        column("full_name", Text),
        column("avatar_url", Text),
        column("headline", Text),
        column("summary", Text),
        column("location_key", Text),
        column("location_name", Text),
        column("canonical_role_key", Text),
        column("canonical_role_name", Text),
        column("total_experience_years", Integer),
        schema="public",
    )


#: Neither view holds an email or a phone, so a list built from one has none to leak.
DIRECTORY_PROFILES: Final = _eligible("candidate_directory_profiles")

SEARCH_PROFILES: Final = _eligible("candidate_search_profiles")


@dataclass(frozen=True, slots=True)
class RequiredSkill:
    taxonomy_id: UUID
    minimum_years: Decimal | None = None


@dataclass(frozen=True, slots=True)
class CandidateFilters:
    location_key: str | None = None
    language_codes: tuple[str, ...] = ()
    canonical_role_key: str | None = None
    minimum_total_experience_years: int | None = None
    skills: tuple[RequiredSkill, ...] = ()


def narrowed_to(profiles: TableClause, filters: CandidateFilters) -> list[ColumnElement[bool]]:
    predicates: list[ColumnElement[bool]] = []
    if filters.location_key:
        predicates.append(profiles.c.location_key == filters.location_key)
    if filters.language_codes:
        predicates.append(_speaks_one_of(profiles.c.candidate_id, filters.language_codes))
    if filters.canonical_role_key:
        predicates.append(profiles.c.canonical_role_key == filters.canonical_role_key)
    if filters.minimum_total_experience_years is not None:
        predicates.append(
            profiles.c.total_experience_years >= filters.minimum_total_experience_years
        )
    predicates += [_holds(profiles.c.candidate_id, skill) for skill in filters.skills]
    return predicates


def _speaks_one_of(
    candidate_id: SQLColumnExpression[UUID], codes: tuple[str, ...]
) -> ColumnElement[bool]:
    return (
        select(CandidateLanguage.candidate_id)
        .where(
            CandidateLanguage.candidate_id == candidate_id,
            CandidateLanguage.language_code.in_(codes),
        )
        .exists()
    )


def _holds(candidate_id: SQLColumnExpression[UUID], skill: RequiredSkill) -> ColumnElement[bool]:
    stated = select(CandidateSkill.candidate_id).where(
        CandidateSkill.candidate_id == candidate_id,
        CandidateSkill.taxonomy_id == skill.taxonomy_id,
    )
    if skill.minimum_years is not None:
        stated = stated.where(CandidateSkill.years_experience >= skill.minimum_years)
    return stated.exists()


def pooled_by(candidate_id: SQLColumnExpression[UUID], tenant_id: UUID) -> ColumnElement[bool]:
    """Membership by the pool's own primary key, so the cost is the page rather than the pool."""
    return (
        select(TalentPoolMember.candidate_id)
        .where(
            TalentPoolMember.tenant_id == tenant_id,
            TalentPoolMember.candidate_id == candidate_id,
        )
        .exists()
    )
