from __future__ import annotations

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

    from sync_api.applications.payload import SubmittedAnswer
    from sync_api.candidates import CandidateProfile


def snapshot_rows(
    application_id: UUID,
    profile: CandidateProfile,
    skills: dict[str, UUID],
    *,
    full_name: str,
    phone: str | None,
) -> list[Base]:
    """The reviewed data, frozen. Immutable from here: the Application is judged and read by
    this, never by the live profile it was copied from."""
    rows: list[Base] = [
        ApplicationProfileSnapshot(
            application_id=application_id,
            full_name=full_name,
            phone=phone,
            headline=profile.headline,
            summary=profile.summary,
            location=profile.location,
        )
    ]
    rows += [
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
    rows += [
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
    rows += [
        ApplicationSkill(
            application_id=application_id,
            sort_order=order,
            taxonomy_id=skills[entry.name],
            years_experience=_as_decimal(entry.years_experience),
        )
        for order, entry in enumerate(profile.skills)
    ]
    rows += [
        ApplicationLanguage(
            application_id=application_id,
            sort_order=order,
            language_code=entry.code,
            proficiency=entry.proficiency,
        )
        for order, entry in enumerate(profile.languages)
    ]
    rows += [
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
    return rows


def screened(
    profile: CandidateProfile, skills: dict[str, UUID], answers: Sequence[SubmittedAnswer]
) -> Snapshot:
    """The same data the rows above hold, in the shape Screening reads."""
    return Snapshot(
        skills=tuple(
            SnapshotSkill(
                taxonomy_id=skills[entry.name],
                years_experience=_as_decimal(entry.years_experience),
            )
            for entry in profile.skills
        ),
        experiences=tuple(
            SnapshotExperience(
                start_year=entry.start_year,
                start_month=entry.start_month,
                end_year=entry.end_year,
                end_month=entry.end_month,
                is_current=entry.is_current,
            )
            for entry in profile.experiences
        ),
        languages=tuple(
            SnapshotLanguage(code=entry.code, proficiency=entry.proficiency)
            for entry in profile.languages
        ),
        answers=tuple(
            SnapshotAnswer(question_id=entry.question_id, answer_boolean=entry.answer_boolean)
            for entry in answers
        ),
    )


def _as_decimal(years: float | None) -> Decimal | None:
    """Through `str`, so `numeric(4,1)` stores the number that was typed, not its float."""
    return None if years is None else Decimal(str(years))
