from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
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
    ApplicationStatusHistory,
    Candidate,
    Communication,
    Cv,
    CvParsingStatus,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import an_uploaded_cv
from tests.support.extractors import a_parse
from tests.support.jobs import TENANT_JOBS, a_published_job, read_job, set_criteria
from tests.support.profiles import a_filled_profile, a_saved_profile, give_a_current_cv, my_id

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.models import ApplicationStatus
    from tests.support.mailbox import Mailbox

APPLICATIONS: Final = "/v1/applications"

TENANT_APPLICATIONS: Final = "/v1/tenants/me/applications"

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
    """A signed-in Candidate holding a current CV. Their profile is still empty."""
    await a_signed_in_candidate(browser, mailbox, label)
    return await give_a_current_cv(session, await my_id(browser))


async def a_candidate_who_can_apply(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    label: str = "applicant",
    **changes: Any,
) -> UUID:
    """The two things applying insists on: a current CV, and a profile worth judging.

    Answers with the current CV's id — what the Snapshot's Application will name.
    """
    cv_id = await a_candidate_with_a_ready_cv(browser, mailbox, session, label)
    await a_saved_profile(browser, a_filled_profile(**changes))
    return cv_id


async def a_candidate_with_a_stored_cv(
    browser: AsyncClient, mailbox: Mailbox, session: AsyncSession, label: str = "applicant"
) -> UUID:
    """The same, with the file really in Storage — which is what a signed link needs."""
    await a_signed_in_candidate(browser, mailbox, label)
    uploaded = await an_uploaded_cv(browser)
    await session.execute(
        update(Cv)
        .where(Cv.id == UUID(uploaded["id"]))
        .values(
            parsing_status=CvParsingStatus.READY,
            # A ready CV carries the parse it was read from; the schema holds it to that, and
            # this stands in for the worker run the test is skipping.
            parsed_cv_data=a_parse().model_dump(mode="json"),
            parsed_at=datetime.now(UTC),
        )
    )
    await session.execute(
        update(Candidate)
        .where(Candidate.id == await my_id(browser))
        .values(current_cv_id=UUID(uploaded["id"]))
    )
    await session.commit()
    await a_saved_profile(browser, a_filled_profile())
    return UUID(uploaded["id"])


async def a_whole_application(
    recruiter: AsyncClient, browser: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, Any]:
    """One Application with everything hanging off it — Snapshot, answers, both histories.

    What a test of the floor underneath an Application needs: a published Job, a Candidate who
    can apply to it, and a submission that really went through the pipeline.
    """
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(browser, mailbox, session)
    return await an_accepted_application(browser, job["id"])


def a_submission(job_id: str | UUID, **changes: Any) -> dict[str, Any]:
    return {"job_id": str(job_id), "answers": [], **changes}


async def apply_to(browser: AsyncClient, job_id: str | UUID, **changes: Any) -> Response:
    return await browser.post(APPLICATIONS, json=a_submission(job_id, **changes))


async def an_accepted_application(
    browser: AsyncClient, job_id: str | UUID, **changes: Any
) -> dict[str, Any]:
    response = await apply_to(browser, job_id, **changes)
    assert response.status_code == 201, response.text
    application: dict[str, Any] = response.json()
    return application


async def my_applications(browser: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await browser.get(APPLICATIONS, params=params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def list_job_applications(
    recruiter: AsyncClient, job_id: str | UUID, **params: Any
) -> Response:
    return await recruiter.get(f"{TENANT_JOBS}/{job_id}/applications", params=params)


async def job_applications_of(
    recruiter: AsyncClient, job_id: str | UUID, **params: Any
) -> list[dict[str, Any]]:
    response = await list_job_applications(recruiter, job_id, **params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def read_application(recruiter: AsyncClient, application_id: str | UUID) -> Response:
    return await recruiter.get(f"{TENANT_APPLICATIONS}/{application_id}")


async def a_reviewed_application(
    recruiter: AsyncClient, application_id: str | UUID
) -> dict[str, Any]:
    response = await read_application(recruiter, application_id)
    assert response.status_code == 200, response.text
    review: dict[str, Any] = response.json()
    return review


async def move_to(
    recruiter: AsyncClient, application_id: str | UUID, status: ApplicationStatus | str
) -> Response:
    return await recruiter.patch(
        f"{TENANT_APPLICATIONS}/{application_id}", json={"status": str(status)}
    )


async def a_moved_application(
    recruiter: AsyncClient, application_id: str | UUID, status: ApplicationStatus | str
) -> dict[str, Any]:
    response = await move_to(recruiter, application_id, status)
    assert response.status_code == 200, response.text
    moved: dict[str, Any] = response.json()
    return moved


async def withdraw(browser: AsyncClient, application_id: str | UUID) -> Response:
    return await browser.post(f"{APPLICATIONS}/{application_id}/withdraw")


async def a_withdrawn_application(
    browser: AsyncClient, application_id: str | UUID
) -> dict[str, Any]:
    response = await withdraw(browser, application_id)
    assert response.status_code == 200, response.text
    withdrawn: dict[str, Any] = response.json()
    return withdrawn


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
