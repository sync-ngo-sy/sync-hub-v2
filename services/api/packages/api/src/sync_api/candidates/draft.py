from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.candidates.payload import (
    DraftExperience,
    DraftSkill,
    ProfileDraft,
    ProfileEducation,
    ProfileLanguage,
    ProfileProject,
)
from sync_core import get_logger
from sync_core.profile import MAX_ENTRIES

logger = get_logger(__name__)

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

    `is_searchable` and `location_key` come from the candidate, not from the CV. The first is a
    setting; the second is a choice from a list, which the free text a CV gives its address in
    is not — "Damascus, Syria" names no Location on its own, and guessing which one it meant is
    how the wrong governorate gets saved.

    The Canonical role is the one thing the CV is allowed to propose into a choice from a list,
    because it is a judgement the parse is asked to make. A CV that supports none leaves
    whatever the candidate has already claimed: a vague CV is not a reason to unsay it.
    """
    return ProfileDraft(
        full_name=parsed.full_name or full_name,
        phone=parsed.phone,
        headline=parsed.headline,
        summary=parsed.summary,
        location_key=candidate.location_key,
        canonical_role_key=parsed.canonical_role or candidate.canonical_role_key,
        is_searchable=candidate.is_searchable,
        unmapped_skills=list(parsed.unmapped_skills),
        experiences=[
            DraftExperience(
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
    if len(merged) > MAX_ENTRIES:
        logger.info("candidates.draft_skills_capped", dropped=len(merged) - MAX_ENTRIES)
    return merged[:MAX_ENTRIES]
