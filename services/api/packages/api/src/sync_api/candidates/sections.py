from __future__ import annotations

from sync_api.candidates.payload import (
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
)
from sync_core.models import (
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
)

#: Every live section carries `candidate_id` and `sort_order`; naming them all is what lets code
#: handed one of them read those two columns off it.
type LiveSection = (
    type[CandidateExperience]
    | type[CandidateEducation]
    | type[CandidateSkill]
    | type[CandidateLanguage]
    | type[CandidateProject]
)


def an_experience(row: CandidateExperience) -> ProfileExperience:
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


def an_education(row: CandidateEducation) -> ProfileEducation:
    return ProfileEducation(
        institution=row.institution,
        degree=row.degree,
        field_of_study=row.field_of_study,
        graduation_year=row.graduation_year,
        description=row.description,
    )


def a_language(row: CandidateLanguage) -> ProfileLanguage:
    return ProfileLanguage(code=row.language_code, proficiency=row.proficiency)


def a_project(row: CandidateProject) -> ProfileProject:
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
