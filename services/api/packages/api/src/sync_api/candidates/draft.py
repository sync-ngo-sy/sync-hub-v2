from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.candidates.payload import (
    DraftSkill,
    ProfileDraft,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
)
from sync_core.profile import MAX_ENTRIES

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_api.candidates.payload import ProfileSkill
    from sync_core.models import Candidate
    from sync_parsers import ParsedCv


def draft_of(
    parsed: ParsedCv,
    *,
    candidate: Candidate,
    full_name: str,
    skills: Sequence[ProfileSkill],
) -> ProfileDraft:
    """What the profile would look like if it came from this CV. Computed, saved nowhere.

    Only skills merge, because only they have a natural key — the Canonical name — so the
    years the candidate typed by hand can be carried across. Experiences, educations and
    projects have no such key, and matching them by shape would leave duplicates to delete.

    `is_searchable` and `preferred_language_code` come from the candidate: they are settings,
    and a CV's `detected_language` is the language the document is written in, not a preference.
    """
    return ProfileDraft(
        full_name=parsed.full_name or full_name,
        phone=parsed.phone,
        headline=parsed.headline,
        summary=parsed.summary,
        location=parsed.location,
        preferred_language_code=candidate.preferred_language_code,
        is_searchable=candidate.is_searchable,
        unmapped_skills=list(parsed.unmapped_skills),
        experiences=[
            ProfileExperience(
                job_title=entry.job_title,
                company_name=entry.company_name,
                start_year=entry.start_year,
                start_month=entry.start_month,
                end_year=entry.end_year,
                end_month=entry.end_month,
                is_current=entry.is_current,
                description=entry.description,
            )
            for entry in parsed.experiences
        ],
        educations=[
            ProfileEducation(
                institution=entry.institution,
                degree=entry.degree,
                field_of_study=entry.field_of_study,
                graduation_year=entry.graduation_year,
                description=entry.description,
            )
            for entry in parsed.educations
        ],
        skills=_merged_skills(parsed, skills),
        languages=[
            ProfileLanguage(code=entry.code, proficiency=entry.proficiency)
            for entry in parsed.languages
        ],
        projects=[
            ProfileProject(
                name=entry.name,
                description=entry.description,
                project_url=entry.project_url,
                repository_url=entry.repository_url,
                start_year=entry.start_year,
                start_month=entry.start_month,
                end_year=entry.end_year,
                end_month=entry.end_month,
            )
            for entry in parsed.projects
        ],
    )


def _merged_skills(parsed: ParsedCv, saved: Sequence[ProfileSkill]) -> list[DraftSkill]:
    """Every saved skill with its years, then the ones this CV names that were not there."""
    merged = [
        DraftSkill(name=skill.name, years_experience=skill.years_experience) for skill in saved
    ]
    already = {skill.name for skill in saved}
    merged += [
        DraftSkill(name=skill.name, years_experience=None)
        for skill in parsed.skills
        if skill.name not in already
    ]
    return merged[:MAX_ENTRIES]
