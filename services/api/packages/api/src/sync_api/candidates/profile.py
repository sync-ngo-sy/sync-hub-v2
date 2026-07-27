"""A Candidate's professional profile: the whole of it, read and written as one value.

Two things follow from "one value" and are worth reading closely.

**The payload is symmetric.** What `GET` returns is exactly what `PUT` accepts, one model
serving both directions, so the SPA can hand back the document it was given with the parts
the candidate edited changed and nothing else. That is also why no child row carries an id:
a save replaces them, so an id would promise a stability that does not exist. Order is the
array's order — position in the list *is* `sort_order`, in and out.

**The save is a replacement, not a merge.** Every section is written from the request, and
a section left out of it is emptied, because a profile that merged would need a second
vocabulary for "delete this experience" while the candidate's screen already has one: the
form they submit.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, model_validator
from sqlalchemy import delete, select

from sync_api.problems import (
    SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
    UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
    UNKNOWN_LANGUAGE_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_api.transactions import transaction
from sync_core import get_logger
from sync_core.models import (
    Base,
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    Language,
    LanguageProficiency,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)

#: How many entries one section may carry. Not a schema limit — the schema has none — but
#: the profile is embedded whole for Global search, and a section nobody could have typed
#: is a way to make that work unboundedly expensive.
MAX_ENTRIES: Final = 50

#: `candidate_skills.years_experience` is `numeric(4,1)`: anything larger overflows the
#: column, and a second decimal place is rounded away on the way in.
MAX_YEARS_EXPERIENCE: Final = 999.9


def _blank_as_unset(value: object) -> object:
    """An empty input on a form means "not set", not "set to nothing"."""
    return None if isinstance(value, str) and not value.strip() else value


Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Paragraph = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
Link = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

OptionalLine = Annotated[Line | None, BeforeValidator(_blank_as_unset)]
OptionalParagraph = Annotated[Paragraph | None, BeforeValidator(_blank_as_unset)]
OptionalLink = Annotated[Link | None, BeforeValidator(_blank_as_unset)]

#: The ranges the `candidate_*` CHECK constraints enforce, restated where a client can be
#: told which field was wrong instead of being handed Postgres's refusal as a 500.
Year = Annotated[int, Field(ge=1900, le=2100)]
Month = Annotated[int, Field(ge=1, le=12)]

LanguageCode = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=8),
    Field(description="A code from the platform's `languages` table.", examples=["en"]),
]

YearsOfExperience = Annotated[float, Field(ge=0, le=MAX_YEARS_EXPERIENCE)]


def _section(description: str) -> Any:
    """One repeated section of the profile, in the candidate's own order."""
    return Field(default_factory=list, max_length=MAX_ENTRIES, description=description)


class DatedRange(BaseModel):
    """Something that ran from roughly one month to roughly another, or still runs.

    Every part is optional because a CV is: "2019 to present" and "March 2019" are both things
    people write, and a profile that refused them would be refusing its own source material.
    """

    start_year: Year | None = None
    start_month: Month | None = None
    end_year: Year | None = None
    end_month: Month | None = None

    @model_validator(mode="after")
    def _ends_after_it_starts(self) -> DatedRange:
        """The `*_ordered` CHECK, restated. Only comparable when both years are known."""
        if self.start_year is None or self.end_year is None:
            return self
        if (self.end_year, self.end_month or 12) < (self.start_year, self.start_month or 1):
            raise ValueError("the end of a period cannot come before its start")
        return self


class ProfileExperience(DatedRange):
    """One job."""

    job_title: Line
    company_name: OptionalLine = None
    is_current: bool = Field(default=False, description="A job with no end, still going.")
    description: OptionalParagraph = None

    @model_validator(mode="after")
    def _current_work_has_not_ended(self) -> ProfileExperience:
        """The `cexp_current_has_no_end` CHECK, restated."""
        if self.is_current and (self.end_year is not None or self.end_month is not None):
            raise ValueError("a current job cannot have an end date")
        return self


class ProfileEducation(BaseModel):
    """One qualification."""

    institution: Line
    degree: OptionalLine = None
    field_of_study: OptionalLine = None
    graduation_year: Year | None = None
    description: OptionalParagraph = None


class ProfileSkill(BaseModel):
    """One Canonical skill, and how long the candidate has been doing it.

    Named rather than identified: a Canonical skill *is* its one spelling, and the CV parse
    speaks in those names — so the review flow can post back what it read.
    """

    name: Line = Field(description="The Canonical skill's exact name.", examples=["Python"])
    years_experience: YearsOfExperience | None = Field(
        default=None, description="Stored to one decimal place. Null means unstated."
    )


class ProfileLanguage(BaseModel):
    """One language the candidate speaks, and how well."""

    code: LanguageCode
    proficiency: LanguageProficiency


class ProfileProject(DatedRange):
    """One thing the candidate built."""

    name: Line
    description: OptionalParagraph = None
    project_url: OptionalLink = None
    repository_url: OptionalLink = None


class CandidateProfile(BaseModel):
    """Everything a Candidate says about themselves professionally.

    One model for both directions: a `GET` body is a valid `PUT` body, unchanged.
    """

    headline: OptionalLine = Field(default=None, examples=["Backend engineer, 8 years"])
    summary: OptionalParagraph = None
    location: OptionalLine = Field(default=None, examples=["Damascus, Syria"])
    preferred_language_code: LanguageCode | None = None
    is_searchable: bool = Field(
        default=False,
        description="Opt in to cross-tenant Global search. Requires a current CV.",
    )

    experiences: list[ProfileExperience] = _section("Jobs, in the candidate's own order.")
    educations: list[ProfileEducation] = _section("Qualifications, in the candidate's own order.")
    skills: list[ProfileSkill] = _section("Canonical skills, in the candidate's own order.")
    languages: list[ProfileLanguage] = _section("Languages spoken, in the candidate's own order.")
    projects: list[ProfileProject] = _section("Projects, in the candidate's own order.")

    @model_validator(mode="after")
    def _one_entry_per_skill_and_language(self) -> CandidateProfile:
        """Both are keyed by what they name, so a repeat is a form bug, not a second entry."""
        _refuse_repeats(self.skills, lambda skill: skill.name, "skill")
        _refuse_repeats(self.languages, lambda language: language.code, "language")
        return self


class CandidateProfileService:
    """One request's worth of profile work."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def profile(self, candidate_id: UUID) -> CandidateProfile:
        """The whole profile in one value, every section in the candidate's own order."""
        candidate = await self._candidate(candidate_id)
        return CandidateProfile(
            headline=candidate.headline,
            summary=candidate.summary,
            location=candidate.location,
            preferred_language_code=candidate.preferred_language_code,
            is_searchable=candidate.is_searchable,
            experiences=await self._experiences(candidate_id),
            educations=await self._educations(candidate_id),
            skills=await self._skills(candidate_id),
            languages=await self._languages(candidate_id),
            projects=await self._projects(candidate_id),
        )

    async def replace(self, candidate_id: UUID, profile: CandidateProfile) -> CandidateProfile:
        """Swap the whole profile for this one, in a single transaction.

        Every child row of every section goes and comes back, rather than being matched up
        with what was there: the candidate sent the profile they want, not a description of
        the edits they made, and reconciling the two would be inventing a diff nobody asked
        for. The cost is one delete and one insert per section; the benefit is that a save
        cannot half-happen, and no reader ever sees a profile mid-edit.

        The re-embed job coalesces itself: every one of those writes fires the enqueue
        trigger, which upserts the candidate's single job row (supabase ADR-0002), so a
        save leaves exactly one — however many sections it touched, and however many saves
        came before it.
        """
        skills = await self._canonical_skill_ids(profile.skills)
        await self._refuse_unknown_languages(profile)

        candidate = await self._candidate(candidate_id)
        if profile.is_searchable and candidate.current_cv_id is None:
            # The `candidates_searchable_needs_cv` CHECK, refused here so it reads as an
            # answer rather than as Postgres declining to write the row.
            raise Problem(
                status=409,
                type=SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
                detail="Upload a CV before making your profile searchable.",
            )

        async with transaction(self._db):
            candidate.headline = profile.headline
            candidate.summary = profile.summary
            candidate.location = profile.location
            candidate.preferred_language_code = profile.preferred_language_code
            candidate.is_searchable = profile.is_searchable
            for section in (
                delete(CandidateExperience).where(CandidateExperience.candidate_id == candidate_id),
                delete(CandidateEducation).where(CandidateEducation.candidate_id == candidate_id),
                delete(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id),
                delete(CandidateLanguage).where(CandidateLanguage.candidate_id == candidate_id),
                delete(CandidateProject).where(CandidateProject.candidate_id == candidate_id),
            ):
                await self._db.execute(section)
            self._db.add_all(_rows_for(candidate_id, profile, skills))

        logger.info("candidates.profile_replaced", profile_id=str(candidate_id))
        return await self.profile(candidate_id)

    async def _canonical_skill_ids(self, skills: Sequence[ProfileSkill]) -> dict[str, UUID]:
        """The taxonomy id behind every named skill, or a refusal naming the ones it lacks.

        Exact spellings only: a Canonical skill is one spelling and one id, and quietly
        accepting a near-miss would put a skill in the profile that Screening never sees.
        """
        if not skills:
            return {}
        names = [skill.name for skill in skills]
        rows = await self._db.execute(
            select(SkillTaxonomy.canonical_name, SkillTaxonomy.id).where(
                SkillTaxonomy.canonical_name.in_(names)
            )
        )
        # `.all()` first: a `Result` has `keys()`, so `dict()` would read it as a mapping
        # and index it by column name rather than pairing up the two columns.
        known: dict[str, UUID] = dict(rows.tuples().all())
        _refuse_unknown(
            [
                InvalidField(
                    location=f"body.skills.{position}.name",
                    message=f"“{skill.name}” is not a Canonical skill.",
                    type="unknown_canonical_skill",
                )
                for position, skill in enumerate(skills)
                if skill.name not in known
            ],
            problem_type=UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
            detail="Every skill has to be one of the platform's Canonical skills.",
        )
        return known

    async def _refuse_unknown_languages(self, profile: CandidateProfile) -> None:
        """Both places a language code can appear, checked in one query."""
        codes = {language.code for language in profile.languages}
        if profile.preferred_language_code is not None:
            codes.add(profile.preferred_language_code)
        if not codes:
            return

        known = set(
            (await self._db.scalars(select(Language.code).where(Language.code.in_(codes)))).all()
        )
        unknown = [
            InvalidField(
                location=f"body.languages.{position}.code",
                message=f"“{language.code}” is not a language the platform knows.",
                type="unknown_language",
            )
            for position, language in enumerate(profile.languages)
            if language.code not in known
        ]
        if profile.preferred_language_code not in {*known, None}:
            unknown.append(
                InvalidField(
                    location="body.preferred_language_code",
                    message=f"“{profile.preferred_language_code}” is not a language "
                    "the platform knows.",
                    type="unknown_language",
                )
            )
        _refuse_unknown(
            unknown,
            problem_type=UNKNOWN_LANGUAGE_PROBLEM_TYPE,
            detail="Every language has to be one of the platform's language codes.",
        )

    async def _candidate(self, candidate_id: UUID) -> Candidate:
        """The Candidate row, which the access gate has already put in the identity map."""
        candidate = await self._db.get(Candidate, candidate_id)
        if candidate is None:  # pragma: no cover — `acting_candidate` refused this already
            raise LookupError(f"no candidate row for {candidate_id}")
        return candidate

    async def _experiences(self, candidate_id: UUID) -> list[ProfileExperience]:
        rows = await self._db.scalars(
            select(CandidateExperience)
            .where(CandidateExperience.candidate_id == candidate_id)
            .order_by(CandidateExperience.sort_order)
        )
        return [
            ProfileExperience(
                job_title=row.job_title,
                company_name=row.company_name,
                start_year=row.start_year,
                start_month=row.start_month,
                end_year=row.end_year,
                end_month=row.end_month,
                is_current=row.is_current,
                description=row.description,
            )
            for row in rows
        ]

    async def _educations(self, candidate_id: UUID) -> list[ProfileEducation]:
        rows = await self._db.scalars(
            select(CandidateEducation)
            .where(CandidateEducation.candidate_id == candidate_id)
            .order_by(CandidateEducation.sort_order)
        )
        return [
            ProfileEducation(
                institution=row.institution,
                degree=row.degree,
                field_of_study=row.field_of_study,
                graduation_year=row.graduation_year,
                description=row.description,
            )
            for row in rows
        ]

    async def _skills(self, candidate_id: UUID) -> list[ProfileSkill]:
        """Skills as the candidate reads them: the taxonomy's spelling, not its id."""
        rows = await self._db.execute(
            select(SkillTaxonomy.canonical_name, CandidateSkill.years_experience)
            .join(SkillTaxonomy, SkillTaxonomy.id == CandidateSkill.taxonomy_id)
            .where(CandidateSkill.candidate_id == candidate_id)
            .order_by(CandidateSkill.sort_order)
        )
        return [
            ProfileSkill(name=name, years_experience=None if years is None else float(years))
            for name, years in rows.tuples()
        ]

    async def _languages(self, candidate_id: UUID) -> list[ProfileLanguage]:
        rows = await self._db.scalars(
            select(CandidateLanguage)
            .where(CandidateLanguage.candidate_id == candidate_id)
            .order_by(CandidateLanguage.sort_order)
        )
        return [
            ProfileLanguage(code=row.language_code, proficiency=row.proficiency) for row in rows
        ]

    async def _projects(self, candidate_id: UUID) -> list[ProfileProject]:
        rows = await self._db.scalars(
            select(CandidateProject)
            .where(CandidateProject.candidate_id == candidate_id)
            .order_by(CandidateProject.sort_order)
        )
        return [
            ProfileProject(
                name=row.name,
                description=row.description,
                project_url=row.project_url,
                repository_url=row.repository_url,
                start_year=row.start_year,
                start_month=row.start_month,
                end_year=row.end_year,
                end_month=row.end_month,
            )
            for row in rows
        ]


def _rows_for(candidate_id: UUID, profile: CandidateProfile, skills: dict[str, UUID]) -> list[Base]:
    """The profile as rows, each section numbered by where the candidate put it."""
    rows: list[Base] = [
        CandidateExperience(
            candidate_id=candidate_id,
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
        CandidateEducation(
            candidate_id=candidate_id,
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
        CandidateSkill(
            candidate_id=candidate_id,
            sort_order=order,
            taxonomy_id=skills[entry.name],
            years_experience=entry.years_experience,
        )
        for order, entry in enumerate(profile.skills)
    ]
    rows += [
        CandidateLanguage(
            candidate_id=candidate_id,
            sort_order=order,
            language_code=entry.code,
            proficiency=entry.proficiency,
        )
        for order, entry in enumerate(profile.languages)
    ]
    rows += [
        CandidateProject(
            candidate_id=candidate_id,
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


def _refuse_unknown(unknown: Sequence[InvalidField], *, problem_type: str, detail: str) -> None:
    """Refuse a reference to data the platform does not have, located field by field.

    The same body a failed schema validation produces, so a client parses one error shape
    however an input was rejected; the `type` is what tells them which rule it broke.
    """
    if not unknown:
        return
    raise Problem(
        status=422,
        type=problem_type,
        detail=detail,
        errors=[field.model_dump() for field in unknown],
    )


def _refuse_repeats(entries: Sequence[Any], name_of: Callable[[Any], str], singular: str) -> None:
    names = [name_of(entry) for entry in entries]
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f"one entry per {singular}; repeated: {', '.join(repeated)}")
