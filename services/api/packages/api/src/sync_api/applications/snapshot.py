from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sqlalchemy import insert, literal, select

from sync_api.applications.payload import AnsweredQuestion, ApplicationSnapshot
from sync_api.applications.screening import (
    Snapshot,
    SnapshotAnswer,
    SnapshotLanguage,
    SnapshotSkill,
)
from sync_api.candidates import (
    LiveSection,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
    a_language,
    a_project,
    an_education,
    an_experience,
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
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    JobApplicationQuestion,
    Location,
    Profile,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy import Executable
    from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class Twin:
    """One section, and the live table it is frozen from. The column names are the same on both
    sides, which is what keeps the copy mechanical and kills the add-a-column-forget-to-map-it
    bug — so one list of names serves the `INSERT` and the `SELECT` alike."""

    frozen: type[Base]
    live: LiveSection
    columns: tuple[str, ...]

    def copy_into(self, application_id: UUID, candidate_id: UUID) -> Executable:
        return insert(self.frozen).from_select(
            ["application_id", *self.columns],
            select(
                literal(application_id),
                *(getattr(self.live, column) for column in self.columns),
            )
            .where(self.live.candidate_id == candidate_id)
            .order_by(self.live.sort_order),
        )


#: `email` is deliberately absent from the scalar row: only `auth.users` has a confirmed one. So
#: are the settings on `candidates` — freezing a setting would leave someone asking why changing
#: it changed nothing. `location` is the one column that is not copied across: the Snapshot
#: freezes what the Location was *called* when the Application was sent, so renaming a
#: Location — or the Candidate moving — never rewrites an Application already judged.
#: `total_experience_years` is copied rather than recomputed, which is the whole point of
#: storing it: an applicant who has not saved their profile lately applies with the number they
#: last saved, and the verdict can be re-explained from the Snapshot alone forever after.
SCALARS: Final = (
    "full_name",
    "phone",
    "headline",
    "summary",
    "location",
    "unmapped_skills",
    "total_experience_years",
)

SECTIONS: Final = (
    Twin(
        frozen=ApplicationExperience,
        live=CandidateExperience,
        columns=(
            "sort_order",
            "job_title",
            "company_name",
            "start_year",
            "start_month",
            "end_year",
            "end_month",
            "is_current",
            "description",
        ),
    ),
    Twin(
        frozen=ApplicationEducation,
        live=CandidateEducation,
        columns=(
            "sort_order",
            "institution",
            "degree",
            "field_of_study",
            "graduation_year",
            "description",
        ),
    ),
    Twin(
        frozen=ApplicationSkill,
        live=CandidateSkill,
        columns=("sort_order", "taxonomy_id", "years_experience"),
    ),
    Twin(
        frozen=ApplicationLanguage,
        live=CandidateLanguage,
        columns=("sort_order", "language_code", "proficiency"),
    ),
    Twin(
        frozen=ApplicationProject,
        live=CandidateProject,
        columns=(
            "sort_order",
            "name",
            "description",
            "project_url",
            "repository_url",
            "start_year",
            "start_month",
            "end_year",
            "end_month",
        ),
    ),
)


def snapshot_rows(application_id: UUID, candidate_id: UUID) -> list[Executable]:
    """The live profile frozen, as six column-listed `INSERT … SELECT`s.

    Immutable from here: the Application is judged and read by this, never by the live profile
    it was copied from.
    """
    scalar_row = insert(ApplicationProfileSnapshot).from_select(
        ["application_id", *SCALARS],
        select(
            literal(application_id),
            Profile.full_name,
            Profile.phone,
            Candidate.headline,
            Candidate.summary,
            Location.name,
            Candidate.unmapped_skills,
            Candidate.total_experience_years,
        )
        .join_from(Candidate, Profile, Profile.id == Candidate.id)
        .outerjoin(Location, Location.key == Candidate.location_key)
        .where(Candidate.id == candidate_id),
    )
    return [
        scalar_row,
        *(section.copy_into(application_id, candidate_id) for section in SECTIONS),
    ]


async def screened(
    session: AsyncSession, application_id: UUID, answers: Sequence[ApplicationAnswer]
) -> Snapshot:
    """What Screening measures: the Snapshot rows just written, and never the live profile."""
    skills = await session.execute(
        select(ApplicationSkill.taxonomy_id, ApplicationSkill.years_experience)
        .where(ApplicationSkill.application_id == application_id)
        .order_by(ApplicationSkill.sort_order)
    )
    languages = await session.execute(
        select(ApplicationLanguage.language_code, ApplicationLanguage.proficiency)
        .where(ApplicationLanguage.application_id == application_id)
        .order_by(ApplicationLanguage.sort_order)
    )
    total_experience_years = await session.scalar(
        select(ApplicationProfileSnapshot.total_experience_years).where(
            ApplicationProfileSnapshot.application_id == application_id
        )
    )
    return Snapshot(
        skills=tuple(
            SnapshotSkill(taxonomy_id=taxonomy_id, years_experience=years)
            for taxonomy_id, years in skills.tuples()
        ),
        total_experience_years=total_experience_years or 0,
        languages=tuple(
            SnapshotLanguage(code=code, proficiency=proficiency)
            for code, proficiency in languages.tuples()
        ),
        answers=tuple(
            SnapshotAnswer(question_id=row.question_id, answer_boolean=row.answer_boolean)
            for row in answers
        ),
    )


async def snapshot_of(session: AsyncSession, application_id: UUID) -> ApplicationSnapshot:
    """The frozen data back out, whole. What a Recruiter reviews and what an assessment
    reads — neither of them ever the live profile it was copied from."""
    captured = await session.get(ApplicationProfileSnapshot, application_id)
    if captured is None:  # pragma: no cover — written in the submission transaction
        raise LookupError(f"no snapshot for application {application_id}")
    return ApplicationSnapshot(
        full_name=captured.full_name,
        phone=captured.phone,
        headline=captured.headline,
        summary=captured.summary,
        location=captured.location,
        unmapped_skills=captured.unmapped_skills,
        total_experience_years=captured.total_experience_years,
        experiences=await _experiences(session, application_id),
        educations=await _educations(session, application_id),
        skills=await _skills(session, application_id),
        languages=await _languages(session, application_id),
        projects=await _projects(session, application_id),
    )


async def answers_of(session: AsyncSession, application_id: UUID) -> list[AnsweredQuestion]:
    """Every question the Job asked, in the order it asked them, and what was answered."""
    rows = await session.execute(
        select(ApplicationAnswer, JobApplicationQuestion)
        .join(JobApplicationQuestion, JobApplicationQuestion.id == ApplicationAnswer.question_id)
        .where(ApplicationAnswer.application_id == application_id)
        .order_by(JobApplicationQuestion.sort_order)
    )
    return [
        AnsweredQuestion(
            question_id=question.id,
            question_text=question.question_text,
            question_type=question.question_type,
            answer_boolean=answer.answer_boolean,
            answer_text=answer.answer_text,
        )
        for answer, question in rows.tuples()
    ]


async def _experiences(session: AsyncSession, application_id: UUID) -> list[ProfileExperience]:
    rows = await session.scalars(
        select(ApplicationExperience)
        .where(ApplicationExperience.application_id == application_id)
        .order_by(ApplicationExperience.sort_order)
    )
    return [an_experience(row) for row in rows]


async def _educations(session: AsyncSession, application_id: UUID) -> list[ProfileEducation]:
    rows = await session.scalars(
        select(ApplicationEducation)
        .where(ApplicationEducation.application_id == application_id)
        .order_by(ApplicationEducation.sort_order)
    )
    return [an_education(row) for row in rows]


async def _languages(session: AsyncSession, application_id: UUID) -> list[ProfileLanguage]:
    rows = await session.scalars(
        select(ApplicationLanguage)
        .where(ApplicationLanguage.application_id == application_id)
        .order_by(ApplicationLanguage.sort_order)
    )
    return [a_language(row) for row in rows]


async def _projects(session: AsyncSession, application_id: UUID) -> list[ProfileProject]:
    rows = await session.scalars(
        select(ApplicationProject)
        .where(ApplicationProject.application_id == application_id)
        .order_by(ApplicationProject.sort_order)
    )
    return [a_project(row) for row in rows]


async def _skills(session: AsyncSession, application_id: UUID) -> list[ProfileSkill]:
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, ApplicationSkill.years_experience)
        .join(SkillTaxonomy, SkillTaxonomy.id == ApplicationSkill.taxonomy_id)
        .where(ApplicationSkill.application_id == application_id)
        .order_by(ApplicationSkill.sort_order)
    )
    return [ProfileSkill(name=name, years_experience=float(years)) for name, years in rows.tuples()]
