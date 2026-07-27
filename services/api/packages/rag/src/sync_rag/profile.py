from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_core.models import (
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    Language,
    Profile,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from decimal import Decimal
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.models import LanguageProficiency


@dataclass(frozen=True, slots=True)
class NamedSkill:
    name: str
    years_experience: Decimal | None


@dataclass(frozen=True, slots=True)
class SpokenLanguage:
    name: str
    proficiency: LanguageProficiency


@dataclass(frozen=True, slots=True)
class CurrentProfile:
    full_name: str | None
    headline: str | None
    summary: str | None
    location: str | None
    experiences: Sequence[CandidateExperience]
    educations: Sequence[CandidateEducation]
    skills: Sequence[NamedSkill]
    languages: Sequence[SpokenLanguage]
    projects: Sequence[CandidateProject]


async def current_profile(session: AsyncSession, candidate_id: UUID) -> CurrentProfile | None:
    identity = (
        await session.execute(
            select(Candidate, Profile.full_name)
            .join(Profile, Profile.id == Candidate.id)
            .where(Candidate.id == candidate_id)
        )
    ).first()
    if identity is None:
        return None

    candidate, full_name = identity
    return CurrentProfile(
        full_name=full_name,
        headline=candidate.headline,
        summary=candidate.summary,
        location=candidate.location,
        experiences=list(
            await session.scalars(
                select(CandidateExperience)
                .where(CandidateExperience.candidate_id == candidate_id)
                .order_by(CandidateExperience.sort_order)
            )
        ),
        educations=list(
            await session.scalars(
                select(CandidateEducation)
                .where(CandidateEducation.candidate_id == candidate_id)
                .order_by(CandidateEducation.sort_order)
            )
        ),
        skills=[
            NamedSkill(name=name, years_experience=years)
            for name, years in (
                await session.execute(
                    select(SkillTaxonomy.canonical_name, CandidateSkill.years_experience)
                    .join(SkillTaxonomy, SkillTaxonomy.id == CandidateSkill.taxonomy_id)
                    .where(CandidateSkill.candidate_id == candidate_id)
                    .order_by(CandidateSkill.sort_order)
                )
            ).tuples()
        ],
        languages=[
            SpokenLanguage(name=name, proficiency=proficiency)
            for name, proficiency in (
                await session.execute(
                    select(Language.name, CandidateLanguage.proficiency)
                    .join(Language, Language.code == CandidateLanguage.language_code)
                    .where(CandidateLanguage.candidate_id == candidate_id)
                    .order_by(CandidateLanguage.sort_order)
                )
            ).tuples()
        ],
        projects=list(
            await session.scalars(
                select(CandidateProject)
                .where(CandidateProject.candidate_id == candidate_id)
                .order_by(CandidateProject.sort_order)
            )
        ),
    )
