from __future__ import annotations

from dataclasses import dataclass, field
from itertools import chain
from typing import TYPE_CHECKING, Any, Final, cast

from sqlalchemy import func, insert, literal, select
from sqlalchemy.dialects.postgresql import JSONB, aggregate_order_by

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
)
from sync_core.models import (
    ApplicationAnswer,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationLanguage,
    ApplicationProfileSnapshot,
    ApplicationProject,
    ApplicationSkill,
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    CanonicalRole,
    JobApplicationQuestion,
    Location,
    Profile,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from uuid import UUID

    from pydantic import BaseModel
    from sqlalchemy import Executable, ScalarSelect
    from sqlalchemy.ext.asyncio import AsyncSession

type FrozenSection = (
    type[ApplicationExperience]
    | type[ApplicationEducation]
    | type[ApplicationSkill]
    | type[ApplicationLanguage]
    | type[ApplicationProject]
)


@dataclass(frozen=True, slots=True)
class Twin:
    """One section, and the live table it is frozen from. The column names are the same on both
    sides, which is what keeps the copy mechanical and kills the add-a-column-forget-to-map-it
    bug — so one list of names serves the `INSERT` and the `SELECT` alike."""

    frozen: FrozenSection
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


@dataclass(frozen=True, slots=True)
class Reading[EntryT: BaseModel]:
    payload: type[EntryT]
    frozen: FrozenSection
    named: Mapping[str, Any] = field(default_factory=dict)

    def of(self, application_id: UUID) -> ScalarSelect[Any]:
        entry = func.jsonb_build_object(
            *chain.from_iterable((name, self._reads(name)) for name in self.payload.model_fields)
        )
        return (
            select(func.jsonb_agg(aggregate_order_by(entry, self.frozen.sort_order), type_=JSONB))
            .where(self.frozen.application_id == application_id)
            .scalar_subquery()
        )

    def entries(self, aggregated: object) -> list[EntryT]:
        rows = cast("list[dict[str, Any]]", aggregated) if aggregated else []
        return [self.payload.model_validate(entry) for entry in rows]

    def _reads(self, name: str) -> Any:
        return self.named[name] if name in self.named else getattr(self.frozen, name)


#: `email` is deliberately absent from the scalar row: only `auth.users` has a confirmed one. So
#: are the settings on `candidates` — freezing a setting would leave someone asking why changing
#: it changed nothing. `location` and `canonical_role` are the two columns not copied across:
#: the Snapshot freezes what each was *called* when the Application was sent, so renaming a
#: Location or a Canonical role — or the Candidate moving, or retraining — never rewrites an
#: Application already judged. `total_experience_years` is copied rather than recomputed, which
#: is the whole point of storing it: an applicant who has not saved their profile lately applies
#: with the number they last saved, and the verdict can be re-explained from the Snapshot alone
#: forever after.
SCALARS: Final = (
    "full_name",
    "phone",
    "phone_country",
    "headline",
    "summary",
    "location",
    "canonical_role",
    "linkedin_url",
    "github_url",
    "portfolio_url",
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

EXPERIENCES: Final = Reading(payload=ProfileExperience, frozen=ApplicationExperience)
EDUCATIONS: Final = Reading(payload=ProfileEducation, frozen=ApplicationEducation)
SKILLS: Final = Reading(
    payload=ProfileSkill,
    frozen=ApplicationSkill,
    named={
        "name": select(SkillTaxonomy.canonical_name)
        .where(SkillTaxonomy.id == ApplicationSkill.taxonomy_id)
        .scalar_subquery()
    },
)
LANGUAGES: Final = Reading(
    payload=ProfileLanguage,
    frozen=ApplicationLanguage,
    named={"code": ApplicationLanguage.language_code},
)
PROJECTS: Final = Reading(payload=ProfileProject, frozen=ApplicationProject)


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
            Profile.phone_country,
            Candidate.headline,
            Candidate.summary,
            Location.name,
            CanonicalRole.name,
            Candidate.linkedin_url,
            Candidate.github_url,
            Candidate.portfolio_url,
            Candidate.unmapped_skills,
            Candidate.total_experience_years,
        )
        .join_from(Candidate, Profile, Profile.id == Candidate.id)
        .outerjoin(Location, Location.key == Candidate.location_key)
        .outerjoin(CanonicalRole, CanonicalRole.key == Candidate.canonical_role_key)
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
    # Read back rather than passed in: a verdict is drawn from the frozen row, so if the freeze
    # did not happen there is no number to judge by — and screening somebody as having no work
    # would be a wrong verdict rather than a missing one.
    total_experience_years = await session.scalar(
        select(ApplicationProfileSnapshot.total_experience_years).where(
            ApplicationProfileSnapshot.application_id == application_id
        )
    )
    if total_experience_years is None:  # pragma: no cover — written in this transaction
        raise LookupError(f"no snapshot for application {application_id}")
    return Snapshot(
        skills=tuple(
            SnapshotSkill(taxonomy_id=taxonomy_id, years_experience=years)
            for taxonomy_id, years in skills.tuples()
        ),
        total_experience_years=total_experience_years,
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
    row = (
        await session.execute(
            select(
                ApplicationProfileSnapshot,
                EXPERIENCES.of(application_id).label("experiences"),
                EDUCATIONS.of(application_id).label("educations"),
                SKILLS.of(application_id).label("skills"),
                LANGUAGES.of(application_id).label("languages"),
                PROJECTS.of(application_id).label("projects"),
            ).where(ApplicationProfileSnapshot.application_id == application_id)
        )
    ).first()
    if row is None:  # pragma: no cover — written in the submission transaction
        raise LookupError(f"no snapshot for application {application_id}")

    captured: ApplicationProfileSnapshot = row.ApplicationProfileSnapshot
    return ApplicationSnapshot(
        full_name=captured.full_name,
        phone=captured.phone,
        phone_country=captured.phone_country,
        headline=captured.headline,
        summary=captured.summary,
        location=captured.location,
        canonical_role=captured.canonical_role,
        linkedin_url=captured.linkedin_url,
        github_url=captured.github_url,
        portfolio_url=captured.portfolio_url,
        unmapped_skills=captured.unmapped_skills,
        total_experience_years=captured.total_experience_years,
        experiences=EXPERIENCES.entries(row.experiences),
        educations=EDUCATIONS.entries(row.educations),
        skills=SKILLS.entries(row.skills),
        languages=LANGUAGES.entries(row.languages),
        projects=PROJECTS.entries(row.projects),
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
