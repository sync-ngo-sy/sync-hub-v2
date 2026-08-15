from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, func, select

from sync_core.models import (
    Candidate,
    CandidateEducation,
    CandidateLanguage,
    CandidateSkill,
    Cv,
    CvParsingStatus,
    Profile,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


class Requirement(StrEnum):
    CV = "cv"
    FULL_NAME = "full_name"
    PHONE = "phone"
    HEADLINE = "headline"
    LOCATION = "location"
    CANONICAL_ROLE = "canonical_role"
    SUMMARY = "summary"
    EDUCATION = "education"
    SKILL = "skill"
    LANGUAGE = "language"


@dataclass(frozen=True, slots=True)
class ProfileFacts:
    has_a_read_cv: bool = False
    full_name: str | None = None
    phone: str | None = None
    phone_country: str | None = None
    headline: str | None = None
    summary: str | None = None
    location_key: str | None = None
    canonical_role_key: str | None = None
    educations: int = 0
    skills: int = 0
    languages: int = 0


def _said(value: str | None) -> bool:
    return value is not None and value.strip() != ""


def missing_requirements(facts: ProfileFacts) -> tuple[Requirement, ...]:
    met = {
        Requirement.CV: facts.has_a_read_cv,
        Requirement.FULL_NAME: _said(facts.full_name),
        Requirement.PHONE: _said(facts.phone) and _said(facts.phone_country),
        Requirement.HEADLINE: _said(facts.headline),
        Requirement.LOCATION: _said(facts.location_key),
        Requirement.CANONICAL_ROLE: _said(facts.canonical_role_key),
        Requirement.SUMMARY: _said(facts.summary),
        Requirement.EDUCATION: facts.educations > 0,
        Requirement.SKILL: facts.skills > 0,
        Requirement.LANGUAGE: facts.languages > 0,
    }
    return tuple(requirement for requirement, held in met.items() if not held)


def completion_percent(missing: tuple[Requirement, ...]) -> int:
    total = len(Requirement)
    met = total - len(missing)
    return (met * 100 + total // 2) // total


type _Section = type[CandidateEducation] | type[CandidateSkill] | type[CandidateLanguage]


def _counted(section: _Section, candidate_id: UUID) -> ColumnElement[int]:
    return (
        select(func.count())
        .select_from(section)
        .where(section.candidate_id == candidate_id)
        .scalar_subquery()
    )


async def profile_facts(session: AsyncSession, candidate_id: UUID) -> ProfileFacts:
    row = (
        await session.execute(
            select(
                Profile.full_name,
                Profile.phone,
                Profile.phone_country,
                Candidate.headline,
                Candidate.summary,
                Candidate.location_key,
                Candidate.canonical_role_key,
                select(Cv.id)
                .where(
                    Cv.id == Candidate.current_cv_id,
                    Cv.candidate_id == Candidate.id,
                    Cv.parsing_status == CvParsingStatus.READY,
                    Cv.deleted_at.is_(None),
                )
                .exists()
                .label("has_a_read_cv"),
                _counted(CandidateEducation, candidate_id).label("educations"),
                _counted(CandidateSkill, candidate_id).label("skills"),
                _counted(CandidateLanguage, candidate_id).label("languages"),
            )
            .join(Profile, Profile.id == Candidate.id)
            .where(Candidate.id == candidate_id)
        )
    ).one()

    return ProfileFacts(
        has_a_read_cv=row.has_a_read_cv,
        full_name=row.full_name,
        phone=row.phone,
        phone_country=row.phone_country,
        headline=row.headline,
        summary=row.summary,
        location_key=row.location_key,
        canonical_role_key=row.canonical_role_key,
        educations=row.educations,
        skills=row.skills,
        languages=row.languages,
    )


async def refresh_completeness(
    session: AsyncSession, candidate_id: UUID
) -> tuple[Requirement, ...]:
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:  # pragma: no cover
        raise LookupError(f"no candidate row for {candidate_id}")

    earned = candidate.profile_completed_at
    candidate.profile_completed_at = None
    await session.flush()

    missing = missing_requirements(await profile_facts(session, candidate_id))
    if not missing:
        candidate.profile_completed_at = earned or datetime.now(UTC)
    return missing
