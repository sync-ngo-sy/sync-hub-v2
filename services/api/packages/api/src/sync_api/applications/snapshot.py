from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING

from sync_api.applications.screening import (
    Snapshot,
    SnapshotAnswer,
    SnapshotExperience,
    SnapshotLanguage,
    SnapshotSkill,
)
from sync_core.models import (
    ApplicationAnswer,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationLanguage,
    ApplicationProfileSnapshot,
    ApplicationProject,
    ApplicationSkill,
    Base,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sync_api.candidates import CandidateProfile


@dataclass(frozen=True, slots=True)
class SnapshotRows:
    """The Snapshot as rows, before they are written. What Screening then reads."""

    profile: ApplicationProfileSnapshot
    experiences: list[ApplicationExperience]
    educations: list[ApplicationEducation]
    skills: list[ApplicationSkill]
    languages: list[ApplicationLanguage]
    projects: list[ApplicationProject]

    def all(self) -> list[Base]:
        return [
            self.profile,
            *self.experiences,
            *self.educations,
            *self.skills,
            *self.languages,
            *self.projects,
        ]


def snapshot_rows(
    application_id: UUID,
    profile: CandidateProfile,
    skills: dict[str, UUID],
    *,
    full_name: str,
    phone: str | None,
) -> SnapshotRows:
    """The reviewed data, frozen. Immutable from here: the Application is judged and read by
    this, never by the live profile it was copied from."""
    captured = ApplicationProfileSnapshot(
        application_id=application_id,
        full_name=full_name,
        phone=phone,
        headline=profile.headline,
        summary=profile.summary,
        location=profile.location,
    )
    experiences = [
        ApplicationExperience(
            application_id=application_id,
            sort_order=order,
            job_title=entry.job_title,
            company_name=entry.company_name,
            start_year=entry.start_year,
            start_month=entry.start_month,
            end_year=entry.end_year,
            end_month=entry.end_month,
            is_current=entry.is_current,
            description=entry.description,
        )
        for order, entry in enumerate(profile.experiences)
    ]
    educations = [
        ApplicationEducation(
            application_id=application_id,
            sort_order=order,
            institution=entry.institution,
            degree=entry.degree,
            field_of_study=entry.field_of_study,
            graduation_year=entry.graduation_year,
            description=entry.description,
        )
        for order, entry in enumerate(profile.educations)
    ]
    application_skills = [
        ApplicationSkill(
            application_id=application_id,
            sort_order=order,
            taxonomy_id=skills[entry.name],
            years_experience=_as_decimal(entry.years_experience),
        )
        for order, entry in enumerate(profile.skills)
    ]
    languages = [
        ApplicationLanguage(
            application_id=application_id,
            sort_order=order,
            language_code=entry.code,
            proficiency=entry.proficiency,
        )
        for order, entry in enumerate(profile.languages)
    ]
    projects = [
        ApplicationProject(
            application_id=application_id,
            sort_order=order,
            name=entry.name,
            description=entry.description,
            project_url=entry.project_url,
            repository_url=entry.repository_url,
            start_year=entry.start_year,
            start_month=entry.start_month,
            end_year=entry.end_year,
            end_month=entry.end_month,
        )
        for order, entry in enumerate(profile.projects)
    ]
    return SnapshotRows(
        profile=captured,
        experiences=experiences,
        educations=educations,
        skills=application_skills,
        languages=languages,
        projects=projects,
    )


def screened(rows: SnapshotRows, answers: Sequence[ApplicationAnswer]) -> Snapshot:
    """What Screening measures: the Snapshot rows themselves, and never the live profile."""
    return Snapshot(
        skills=tuple(
            SnapshotSkill(taxonomy_id=row.taxonomy_id, years_experience=row.years_experience)
            for row in rows.skills
        ),
        experiences=tuple(
            SnapshotExperience(
                start_year=row.start_year,
                start_month=row.start_month,
                end_year=row.end_year,
                end_month=row.end_month,
                is_current=row.is_current,
            )
            for row in rows.experiences
        ),
        languages=tuple(
            SnapshotLanguage(code=row.language_code, proficiency=row.proficiency)
            for row in rows.languages
        ),
        answers=tuple(
            SnapshotAnswer(question_id=row.question_id, answer_boolean=row.answer_boolean)
            for row in answers
        ),
    )


def _as_decimal(years: float | None) -> Decimal | None:
    """Through `str`, so `numeric(4,1)` stores the number that was typed, not its float."""
    return None if years is None else Decimal(str(years))
