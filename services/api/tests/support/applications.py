from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import select, update

from sync_core.models import (
    Application,
    ApplicationAnswer,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationLanguage,
    ApplicationProfileSnapshot,
    ApplicationProject,
    ApplicationQualificationHistory,
    ApplicationSkill,
    ApplicationStatus,
    ApplicationStatusHistory,
    Communication,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import a_published_job, read_job, set_criteria
from tests.support.profiles import a_profile, give_a_current_cv, my_id

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

APPLICATIONS: Final = "/v1/applications"

A_YES_NO_QUESTION: Final[dict[str, Any]] = {
    "question_text": "Do you have the right to work in Syria?",
    "question_type": "yes_no",
    "is_required": True,
    "accepted_boolean_answer": True,
}

A_SHORT_TEXT_QUESTION: Final[dict[str, Any]] = {
    "question_text": "When could you start?",
    "question_type": "short_text",
    "is_required": True,
    "accepted_boolean_answer": None,
}


async def a_job_screening_on(recruiter: AsyncClient, **criteria: Any) -> dict[str, Any]:
    """A published Job whose criteria are already set — the whole Job, questions and all."""
    job = await a_published_job(recruiter)
    replaced = await set_criteria(recruiter, job["id"], **criteria)
    assert replaced.status_code == 200, replaced.text
    return await read_job(recruiter, job["id"])


def questions_of(job: dict[str, Any]) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = job["criteria"]["questions"]
    return questions


async def a_candidate_with_a_ready_cv(
    browser: AsyncClient, mailbox: Mailbox, session: AsyncSession, label: str = "applicant"
) -> UUID:
    """A signed-in Candidate holding the one thing applying insists on."""
    await a_signed_in_candidate(browser, mailbox, label)
    return await give_a_current_cv(session, await my_id(browser))


def a_submission(job_id: str | UUID, cv_id: str | UUID, **changes: Any) -> dict[str, Any]:
    return {
        "job_id": str(job_id),
        "cv_id": str(cv_id),
        "profile": a_profile(),
        "answers": [],
        "update_profile": False,
        **changes,
    }


async def apply_to(
    browser: AsyncClient, job_id: str | UUID, cv_id: str | UUID, **changes: Any
) -> Response:
    return await browser.post(APPLICATIONS, json=a_submission(job_id, cv_id, **changes))


async def an_accepted_application(
    browser: AsyncClient, job_id: str | UUID, cv_id: str | UUID, **changes: Any
) -> dict[str, Any]:
    response = await apply_to(browser, job_id, cv_id, **changes)
    assert response.status_code == 201, response.text
    application: dict[str, Any] = response.json()
    return application


async def my_applications(browser: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await browser.get(APPLICATIONS, params=params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def stored_application(session: AsyncSession, application_id: str | UUID) -> Application:
    session.expire_all()
    application = await session.get(Application, UUID(str(application_id)))
    assert application is not None, f"no applications row for {application_id}"
    return application


async def answers_of(session: AsyncSession, application_id: str | UUID) -> list[ApplicationAnswer]:
    session.expire_all()
    rows = await session.scalars(
        select(ApplicationAnswer).where(
            ApplicationAnswer.application_id == UUID(str(application_id))
        )
    )
    return list(rows)


async def status_history_of(
    session: AsyncSession, application_id: str | UUID
) -> list[ApplicationStatusHistory]:
    session.expire_all()
    rows = await session.scalars(
        select(ApplicationStatusHistory)
        .where(ApplicationStatusHistory.application_id == UUID(str(application_id)))
        .order_by(ApplicationStatusHistory.created_at)
    )
    return list(rows)


async def qualification_history_of(
    session: AsyncSession, application_id: str | UUID
) -> list[ApplicationQualificationHistory]:
    session.expire_all()
    rows = await session.scalars(
        select(ApplicationQualificationHistory)
        .where(ApplicationQualificationHistory.application_id == UUID(str(application_id)))
        .order_by(ApplicationQualificationHistory.created_at)
    )
    return list(rows)


async def communications_of(
    session: AsyncSession, application_id: str | UUID
) -> list[Communication]:
    session.expire_all()
    rows = await session.scalars(
        select(Communication)
        .where(Communication.application_id == UUID(str(application_id)))
        .order_by(Communication.created_at)
    )
    return list(rows)


@dataclass(frozen=True, slots=True)
class Snapshot:
    profile: ApplicationProfileSnapshot | None
    experiences: list[ApplicationExperience]
    educations: list[ApplicationEducation]
    skills: list[ApplicationSkill]
    languages: list[ApplicationLanguage]
    projects: list[ApplicationProject]


async def snapshot_of(session: AsyncSession, application_id: str | UUID) -> Snapshot:
    session.expire_all()
    identifier = UUID(str(application_id))

    async def section(entity: Any, order_by: Any) -> list[Any]:
        rows = await session.scalars(
            select(entity).where(entity.application_id == identifier).order_by(order_by)
        )
        return list(rows)

    return Snapshot(
        profile=await session.get(ApplicationProfileSnapshot, identifier),
        experiences=await section(ApplicationExperience, ApplicationExperience.sort_order),
        educations=await section(ApplicationEducation, ApplicationEducation.sort_order),
        skills=await section(ApplicationSkill, ApplicationSkill.sort_order),
        languages=await section(ApplicationLanguage, ApplicationLanguage.sort_order),
        projects=await section(ApplicationProject, ApplicationProject.sort_order),
    )


async def applications_of(session: AsyncSession, candidate_id: UUID) -> list[Application]:
    session.expire_all()
    rows = await session.scalars(
        select(Application).where(Application.candidate_id == candidate_id)
    )
    return list(rows)


async def withdraw(session: AsyncSession, application_id: str | UUID) -> None:
    """What #13's endpoint will do, written directly: what matters here is that the row stays."""
    await session.execute(
        update(Application)
        .where(Application.id == UUID(str(application_id)))
        .values(status=ApplicationStatus.WITHDRAWN)
    )
    await session.commit()
