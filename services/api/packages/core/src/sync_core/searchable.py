from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sqlalchemy import ARRAY, DateTime, Integer, Text, Uuid, column, select, table

from sync_core.models import CandidateLanguage, CandidateSkill, TalentPoolMember

if TYPE_CHECKING:
    from decimal import Decimal
    from uuid import UUID

    from sqlalchemy import ColumnElement, SQLColumnExpression
    from sqlalchemy.sql import TableClause

    from sync_core.models import LanguageProficiency


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
        column("language_names", ARRAY(Text())),
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
class RequiredLanguage:
    code: str
    minimum_proficiency: LanguageProficiency | None = None


@dataclass(frozen=True, slots=True)
class CandidateFilters:
    location_key: str | None = None
    languages: tuple[RequiredLanguage, ...] = ()
    canonical_role_key: str | None = None
    minimum_total_experience_years: int | None = None
    skills: tuple[RequiredSkill, ...] = ()


def narrowed_to(profiles: TableClause, filters: CandidateFilters) -> list[ColumnElement[bool]]:
    predicates: list[ColumnElement[bool]] = []
    if filters.location_key:
        predicates.append(profiles.c.location_key == filters.location_key)
    if filters.canonical_role_key:
        predicates.append(profiles.c.canonical_role_key == filters.canonical_role_key)
    if filters.minimum_total_experience_years is not None:
        predicates.append(
            profiles.c.total_experience_years >= filters.minimum_total_experience_years
        )
    predicates += [_speaks(profiles.c.candidate_id, language) for language in filters.languages]
    predicates += [_holds(profiles.c.candidate_id, skill) for skill in filters.skills]
    return predicates


def _speaks(
    candidate_id: SQLColumnExpression[UUID], language: RequiredLanguage
) -> ColumnElement[bool]:
    """One predicate per language, so naming two asks for both.

    `proficiency >= :minimum` is the enum's own ordering, declared weakest first, which is what
    makes "intermediate" mean intermediate and everything above it.
    """
    spoken = select(CandidateLanguage.candidate_id).where(
        CandidateLanguage.candidate_id == candidate_id,
        CandidateLanguage.language_code == language.code,
    )
    if language.minimum_proficiency is not None:
        spoken = spoken.where(CandidateLanguage.proficiency >= language.minimum_proficiency)
    return spoken.exists()


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
