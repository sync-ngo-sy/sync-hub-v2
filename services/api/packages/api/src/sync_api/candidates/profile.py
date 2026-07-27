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
from sync_api.problems import SEARCHABLE_NEEDS_CV_PROBLEM_TYPE, Problem
from sync_api.vocabulary import canonical_skill_ids, refuse_unknown_languages
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
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)


class CandidateProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def profile(self, candidate_id: UUID) -> CandidateProfile:
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
        skills = await canonical_skill_ids(self._db, skills_named(profile))
        await refuse_unknown_languages(self._db, languages_named(profile))

        async with transaction(self._db):
            await replace_live_profile(self._db, candidate_id, profile, skills)

        logger.info("candidates.profile_replaced", candidate_id=str(candidate_id))
        return await self.profile(candidate_id)

    async def _candidate(self, candidate_id: UUID) -> Candidate:
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


async def replace_live_profile(
    session: AsyncSession, candidate_id: UUID, profile: CandidateProfile, skills: dict[str, UUID]
) -> None:
    """Everything replacing a profile writes, without a transaction of its own.

    A submission that also updates the live profile has to land in the *same* transaction as
    the Application, so the write is here and the commit is the caller's. The candidate row is
    locked for the duration: without it, two saves each delete only what the other has already
    committed and both sets of inserts survive.
    """
    candidate = await session.get(Candidate, candidate_id, with_for_update=True)
    if candidate is None:  # pragma: no cover — `acting_candidate` refused this already
        raise LookupError(f"no candidate row for {candidate_id}")
    if profile.is_searchable and not await _has_a_ready_cv(session, candidate):
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
        await session.execute(section)
    session.add_all(_rows_for(candidate_id, profile, skills))


async def _has_a_ready_cv(session: AsyncSession, candidate: Candidate) -> bool:
    if candidate.current_cv_id is None:
        return False
    cv = await session.get(Cv, candidate.current_cv_id)
    return cv is not None and cv.parsing_status is CvParsingStatus.READY and cv.deleted_at is None


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


def skills_named(profile: CandidateProfile, at: str = "body") -> dict[str, str]:
    """Every skill name, keyed by where it sat in the request that carried the profile."""
    return {
        f"{at}.skills.{position}.name": skill.name for position, skill in enumerate(profile.skills)
    }


def languages_named(profile: CandidateProfile, at: str = "body") -> dict[str, str]:
    """`preferred_language_code` is a language too, and is refused where the candidate typed it."""
    named = {
        f"{at}.languages.{position}.code": language.code
        for position, language in enumerate(profile.languages)
    }
    if profile.preferred_language_code is not None:
        named[f"{at}.preferred_language_code"] = profile.preferred_language_code
    return named
