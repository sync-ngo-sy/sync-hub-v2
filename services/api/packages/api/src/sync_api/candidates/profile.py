from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, delete, exists, select

from sync_api.candidates.payload import (
    CandidateProfile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.candidates.sections import (
    LiveSection,
    a_language,
    a_project,
    an_education,
    an_experience,
)
from sync_api.problems import (
    INCOMPLETE_PROFILE_PROBLEM_TYPE,
    SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
    Problem,
)
from sync_api.vocabulary import (
    canonical_skill_ids,
    refuse_unknown_canonical_role,
    refuse_unknown_languages,
    refuse_unknown_location,
)
from sync_core import get_logger, transaction
from sync_core.experience import WorkPeriod, business_today, total_experience_years
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
    Profile,
    SkillTaxonomy,
)
from sync_core.profile import as_decimal

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)


class CandidateProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def profile(self, candidate_id: UUID) -> CandidateProfile:
        candidate, identity = await self._candidate(candidate_id)
        return CandidateProfile(
            full_name=identity.full_name,
            phone=identity.phone,
            headline=candidate.headline,
            summary=candidate.summary,
            location_key=candidate.location_key,
            canonical_role_key=candidate.canonical_role_key,
            preferred_language_code=candidate.preferred_language_code,
            is_searchable=candidate.is_searchable,
            total_experience_years=candidate.total_experience_years,
            unmapped_skills=candidate.unmapped_skills,
            experiences=await self._experiences(candidate_id),
            educations=await self._educations(candidate_id),
            skills=await stated_skills(self._db, candidate_id),
            languages=await self._languages(candidate_id),
            projects=await self._projects(candidate_id),
        )

    async def replace(self, candidate_id: UUID, profile: CandidateProfile) -> CandidateProfile:
        """Replace the profile whole, identity included, in one transaction.

        The candidate row is locked for the duration: without it, two saves each delete only
        what the other has already committed and both sets of inserts survive.
        """
        skills = await canonical_skill_ids(self._db, skills_named(profile))
        await refuse_unknown_languages(self._db, languages_named(profile))
        await refuse_unknown_location(self._db, profile.location_key, at="body.location_key")
        await refuse_unknown_canonical_role(
            self._db, profile.canonical_role_key, at="body.canonical_role_key"
        )

        async with transaction(self._db):
            candidate, identity = await self._candidate(candidate_id, lock=True)
            if profile.is_searchable and not await self._has_a_ready_cv(candidate):
                raise Problem(
                    status=409,
                    type=SEARCHABLE_NEEDS_CV_PROBLEM_TYPE,
                    detail="Upload a CV and wait for it to be processed before making your "
                    "profile searchable.",
                )

            identity.full_name = profile.full_name
            identity.phone = profile.phone
            candidate.headline = profile.headline
            candidate.summary = profile.summary
            candidate.location_key = profile.location_key
            candidate.canonical_role_key = profile.canonical_role_key
            candidate.preferred_language_code = profile.preferred_language_code
            candidate.is_searchable = profile.is_searchable
            # Derived here and never read off the request: whatever a caller sends is ignored,
            # so the number and the jobs it came from cannot disagree.
            derived = derived_experience(profile.experiences)
            candidate.total_experience_years = derived
            candidate.unmapped_skills = profile.unmapped_skills
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
        # The reply is what was written, not a re-read of it. Every field on the way out either
        # arrived on the request and was stored as it came — the skill names are the taxonomy's
        # own spellings, and the years are already rounded to the precision the column keeps —
        # or was derived here, which is `total_experience_years` and nothing else. Reading it back
        # was six more round trips to be told what this method had just decided.
        return profile.model_copy(update={"total_experience_years": derived})

    async def _candidate(
        self, candidate_id: UUID, *, lock: bool = False
    ) -> tuple[Candidate, Profile]:
        return await whole_candidate(self._db, candidate_id, lock=lock)

    async def _has_a_ready_cv(self, candidate: Candidate) -> bool:
        if candidate.current_cv_id is None:
            return False
        cv = await self._db.get(Cv, candidate.current_cv_id)
        return (
            cv is not None and cv.parsing_status is CvParsingStatus.READY and cv.deleted_at is None
        )

    async def _experiences(self, candidate_id: UUID) -> list[ProfileExperience]:
        rows = await self._db.scalars(
            select(CandidateExperience)
            .where(CandidateExperience.candidate_id == candidate_id)
            .order_by(CandidateExperience.sort_order)
        )
        return [an_experience(row) for row in rows]

    async def _educations(self, candidate_id: UUID) -> list[ProfileEducation]:
        rows = await self._db.scalars(
            select(CandidateEducation)
            .where(CandidateEducation.candidate_id == candidate_id)
            .order_by(CandidateEducation.sort_order)
        )
        return [an_education(row) for row in rows]

    async def _languages(self, candidate_id: UUID) -> list[ProfileLanguage]:
        rows = await self._db.scalars(
            select(CandidateLanguage)
            .where(CandidateLanguage.candidate_id == candidate_id)
            .order_by(CandidateLanguage.sort_order)
        )
        return [a_language(row) for row in rows]

    async def _projects(self, candidate_id: UUID) -> list[ProfileProject]:
        rows = await self._db.scalars(
            select(CandidateProject)
            .where(CandidateProject.candidate_id == candidate_id)
            .order_by(CandidateProject.sort_order)
        )
        return [a_project(row) for row in rows]


async def whole_candidate(
    session: AsyncSession, candidate_id: UUID, *, lock: bool = False
) -> tuple[Candidate, Profile]:
    """The two rows one profile is spread across: the claims, and the identity.

    One statement, because the two share a primary key — `candidates.id` *is* `profiles.id` — so
    asking for them separately was two round trips for one index lookup's worth of work.

    `lock` takes the candidate row `FOR UPDATE`, and only that row: every writer of a profile
    queues on it, so a reader about to copy the profile somewhere should take it too. The
    identity comes along unlocked, as it did before.
    """
    query = (
        select(Candidate, Profile)
        .join(Profile, Profile.id == Candidate.id)
        .where(Candidate.id == candidate_id)
    )
    if lock:
        query = query.with_for_update(of=Candidate)

    found = (await session.execute(query)).tuples().first()
    if found is None:  # pragma: no cover — `acting_candidate` refused this
        raise LookupError(f"no candidate row for {candidate_id}")
    return found


async def refuse_incomplete_profile(session: AsyncSession, candidate_id: UUID) -> None:
    """A profile too thin to judge an Application by. Named, because "422" alone sends nobody
    anywhere.

    Three yes/no questions, one statement. They were three `count(*)`s — each one a round trip,
    each one counting rows to find out whether there were any — inside the submission's own
    transaction, where they hold the candidate row's lock while they wait.
    """
    row = (
        await session.execute(
            select(
                _has_a_section(CandidateSkill, candidate_id).label("skills"),
                _has_a_section(CandidateExperience, candidate_id).label("experiences"),
                _has_a_section(CandidateEducation, candidate_id).label("educations"),
            )
        )
    ).one()

    missing = []
    if not row.skills:
        missing.append("at least one skill")
    if not row.experiences and not row.educations:
        missing.append("either a job or a qualification")
    if missing:
        raise Problem(
            status=422,
            type=INCOMPLETE_PROFILE_PROBLEM_TYPE,
            detail=f"Your profile needs {' and '.join(missing)} before you can apply. "
            "Fill it in in your profile settings.",
        )


def _has_a_section(section: LiveSection, candidate_id: UUID) -> ColumnElement[bool]:
    """`exists`, not `count`: the question is whether there is one, and it stops at the first."""
    return exists().where(section.candidate_id == candidate_id)


async def stated_skills(session: AsyncSession, candidate_id: UUID) -> list[ProfileSkill]:
    """The candidate's Canonical skills, in their own order, with the years they typed."""
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, CandidateSkill.years_experience)
        .join(SkillTaxonomy, SkillTaxonomy.id == CandidateSkill.taxonomy_id)
        .where(CandidateSkill.candidate_id == candidate_id)
        .order_by(CandidateSkill.sort_order)
    )
    return [ProfileSkill(name=name, years_experience=float(years)) for name, years in rows.tuples()]


def _rows_for(candidate_id: UUID, profile: CandidateProfile, skills: dict[str, UUID]) -> list[Base]:
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
            years_experience=as_decimal(entry.years_experience),
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


def derived_experience(jobs: Sequence[ProfileExperience]) -> int:
    """Total experience from the jobs a profile carries, as of the day it is being saved."""
    return total_experience_years(
        [
            WorkPeriod(
                start_year=job.start_year,
                start_month=job.start_month,
                end_year=job.end_year,
                end_month=job.end_month,
            )
            for job in jobs
        ],
        business_today(),
    )


def skills_named(profile: CandidateProfile) -> dict[str, str]:
    """Every skill name, keyed by where it sat in the request that carried the profile."""
    return {
        f"body.skills.{position}.name": skill.name for position, skill in enumerate(profile.skills)
    }


def languages_named(profile: CandidateProfile) -> dict[str, str]:
    """`preferred_language_code` is a language too, and is refused where the candidate typed it."""
    named = {
        f"body.languages.{position}.code": language.code
        for position, language in enumerate(profile.languages)
    }
    if profile.preferred_language_code is not None:
        named["body.preferred_language_code"] = profile.preferred_language_code
    return named
