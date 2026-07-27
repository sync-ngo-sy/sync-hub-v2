"""Reading and replacing a Candidate's professional profile.

The payload this works in is `sync_api.candidates.payload`; what happens here is the trip
between it and the `candidate_*` tables.

**The save is a replacement, not a merge.** Every section is written from the request, and
a section left out of it is emptied, because a profile that merged would need a second
vocabulary for "delete this experience" while the candidate's screen already has one: the
form they submit. It is also one transaction, so nothing ever reads a profile whose
headline and experiences describe different people.

**Everything that can refuse the save refuses it before the first write.** The skills, the
language codes and the Searchable opt-in are all checked against rows this request does not
own, and a check that ran between the deletes and the inserts would answer a client with a
profile it had already half emptied.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from sync_api.candidates.payload import (
    CandidateProfile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.problems import (
    SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
    UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
    UNKNOWN_LANGUAGE_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import (
    Base,
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    Cv,
    CvParsingStatus,
    Language,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)


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

        The candidate row is locked for the duration, which is what makes two saves at once
        last-write-wins rather than a merge of both. Without it each transaction deletes
        only the rows the other had already committed, and the two sets of inserts land
        together — leaving a profile that is neither save, or a duplicate-key failure on
        `candidate_skills` for whichever one lost.

        The re-embed job coalesces itself: every one of those writes fires the enqueue
        trigger, which upserts the candidate's single job row (supabase ADR-0002), so a
        save leaves exactly one — however many sections it touched, and however many saves
        came before it.
        """
        skills = await self._canonical_skill_ids(profile.skills)
        await self._refuse_unknown_languages(profile)

        async with transaction(self._db):
            candidate = await self._candidate(candidate_id, lock=True)
            if profile.is_searchable and not await self._has_a_ready_cv(candidate):
                raise Problem(
                    status=409,
                    type=SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
                    detail="Upload a CV and wait for it to be processed before making your "
                    "profile searchable.",
                )

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

        logger.info("candidates.profile_replaced", candidate_id=str(candidate_id))
        return await self.profile(candidate_id)

    async def _canonical_skill_ids(self, skills: Sequence[ProfileSkill]) -> dict[str, UUID]:
        """The taxonomy id behind every named skill, or a refusal naming the ones it lacks.

        Exact spellings only: a Canonical skill is one spelling and one id, and quietly
        accepting a near-miss would put a skill in the profile that Screening never sees.
        """
        if not skills:
            return {}
        rows = await self._db.execute(
            select(SkillTaxonomy.canonical_name, SkillTaxonomy.id).where(
                SkillTaxonomy.canonical_name.in_([skill.name for skill in skills])
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

    async def _has_a_ready_cv(self, candidate: Candidate) -> bool:
        """Whether the candidate has a current CV that has actually been parsed.

        The `candidates_searchable_needs_cv` CHECK can only see `current_cv_id`; migration
        02 leaves the rest of the condition here, because "and that CV is `ready`" is a
        second row and a constraint cannot reach it. Global search serves profiles built
        from a parsed CV, so opting in without one would list a candidate the search index
        has nothing of.
        """
        if candidate.current_cv_id is None:
            return False
        # Its own candidate's CV by construction: `candidates(id, current_cv_id)` is a
        # composite foreign key into `cvs(candidate_id, id)`.
        cv = await self._db.get(Cv, candidate.current_cv_id)
        return (
            cv is not None and cv.parsing_status is CvParsingStatus.READY and cv.deleted_at is None
        )

    async def _candidate(self, candidate_id: UUID, *, lock: bool = False) -> Candidate:
        """The Candidate row, which the access gate has already put in the identity map.

        `lock` re-reads it `FOR UPDATE`, which is how a save takes its turn.
        """
        candidate = await self._db.get(Candidate, candidate_id, with_for_update=lock)
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
    """The profile as rows, each section numbered by where the candidate put it.

    Here rather than on `CandidateProfile` deliberately: the payload is the contract with
    the SPA, and it stays free of the tables that happen to store it.
    """
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
    however an input was rejected; the `type` is what tells them which rule it broke. Dumped
    to dicts because a `Problem`'s extensions are serialized as they are given, and a
    `ProblemDetail` holding models would reach the JSON encoder still holding models.
    """
    if not unknown:
        return
    raise Problem(
        status=422,
        type=problem_type,
        detail=detail,
        errors=[field.model_dump() for field in unknown],
    )
