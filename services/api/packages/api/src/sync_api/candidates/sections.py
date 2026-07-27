from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.candidates.payload import (
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
)

if TYPE_CHECKING:
    from sync_core.models import (
        ApplicationEducation,
        ApplicationExperience,
        ApplicationLanguage,
        ApplicationProject,
        CandidateEducation,
        CandidateExperience,
        CandidateLanguage,
        CandidateProject,
    )

# A Snapshot section and the live section it was copied from carry the same fields, so one
# reading of a row serves the profile a Candidate edits and the frozen one a Recruiter reads.


def an_experience(row: CandidateExperience | ApplicationExperience) -> ProfileExperience:
    return ProfileExperience(
        job_title=row.job_title,
        company_name=row.company_name,
        start_year=row.start_year,
        start_month=row.start_month,
        end_year=row.end_year,
        end_month=row.end_month,
        is_current=row.is_current,
        description=row.description,
    )


def an_education(row: CandidateEducation | ApplicationEducation) -> ProfileEducation:
    return ProfileEducation(
        institution=row.institution,
        degree=row.degree,
        field_of_study=row.field_of_study,
        graduation_year=row.graduation_year,
        description=row.description,
    )


def a_language(row: CandidateLanguage | ApplicationLanguage) -> ProfileLanguage:
    return ProfileLanguage(code=row.language_code, proficiency=row.proficiency)


def a_project(row: CandidateProject | ApplicationProject) -> ProfileProject:
    return ProfileProject(
        name=row.name,
        description=row.description,
        project_url=row.project_url,
        repository_url=row.repository_url,
        start_year=row.start_year,
        start_month=row.start_month,
        end_year=row.end_year,
        end_month=row.end_month,
    )
