from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import func, select, text, update

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
    Candidate,
    Communication,
    Cv,
    CvParsingStatus,
    HireClaim,
    Notification,
)
from tests.support.candidates import Signup, a_signed_in_candidate
from tests.support.cvs import an_uploaded_cv
from tests.support.extractors import a_parse
from tests.support.jobs import (
    TENANT_JOBS,
    a_published_job,
    follow_link,
    read_job,
    read_public_job,
    set_criteria,
)
from tests.support.profiles import a_filled_profile, a_saved_profile, give_a_current_cv, my_id

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

APPLICATIONS: Final = "/v1/applications"

#: The day a claimed hire says the work started, when a test does not care which day it was.
A_START_DATE: Final = date(2026, 9, 1)

TENANT_APPLICATIONS: Final = "/v1/tenants/me/applications"

TENANT_HIRE_CLAIMS: Final = "/v1/tenants/me/hire-claims"

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


@dataclass(frozen=True, slots=True)
class Applicant:
    """A Candidate ready to apply, and the account they signed up with — which is where a
    confirmed address lives, and so the only thing a live email can be checked against."""

    id: UUID
    signup: Signup
    cv_id: UUID


async def an_applicant_who_can_apply(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    label: str = "applicant",
    **changes: Any,
) -> Applicant:
    """The two things applying insists on: a current CV, and a Complete profile."""
    signup = await a_signed_in_candidate(browser, mailbox, label)
    candidate_id = await my_id(browser)
    cv_id = await give_a_current_cv(session, candidate_id)
    await a_saved_profile(browser, a_filled_profile(**changes))
    return Applicant(id=candidate_id, signup=signup, cv_id=cv_id)


async def a_candidate_who_can_apply(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    label: str = "applicant",
    **changes: Any,
) -> UUID:
    """The same, answering with the current CV's id — what the Application will name."""
    applicant = await an_applicant_who_can_apply(browser, mailbox, session, label, **changes)
    return applicant.cv_id


async def an_applicant_with_a_stored_cv(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    label: str = "applicant",
    **changes: Any,
) -> Applicant:
    """The same, with the file really in Storage — which is what a signed link needs, and so
    what reading an Application back insists on."""
    signup = await a_signed_in_candidate(browser, mailbox, label)
    candidate_id = await my_id(browser)
    cv_id = UUID((await an_uploaded_cv(browser))["id"])
    await session.execute(
        update(Cv)
        .where(Cv.id == cv_id)
        .values(
            parsing_status=CvParsingStatus.READY,
            parsed_cv_data=a_parse().model_dump(mode="json"),
            parsed_at=datetime.now(UTC),
        )
    )
    await session.execute(
        update(Candidate).where(Candidate.id == candidate_id).values(current_cv_id=cv_id)
    )
    await session.commit()
    await a_saved_profile(browser, a_filled_profile(**changes))
    return Applicant(id=candidate_id, signup=signup, cv_id=cv_id)


async def a_candidate_with_a_stored_cv(
    browser: AsyncClient, mailbox: Mailbox, session: AsyncSession, label: str = "applicant"
) -> UUID:
    """The same, answering with the stored CV's id — what the Application will name."""
    applicant = await an_applicant_with_a_stored_cv(browser, mailbox, session, label)
    return applicant.cv_id


async def a_whole_application(
    recruiter: AsyncClient, browser: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, Any]:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(browser, mailbox, session)
    return await an_accepted_application(browser, job["id"])


async def an_application_through(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    job_id: str | UUID,
    token: str,
    label: str = "applicant",
) -> dict[str, Any]:
    """Somebody who arrived on a Tracked link and applied — how a channel earns an Application."""
    await a_candidate_who_can_apply(browser, mailbox, session, label)
    landed = await follow_link(browser, token)
    assert landed.status_code == 200, landed.text
    return await an_accepted_application(browser, job_id)


async def an_application_from_nowhere(
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    job_id: str | UUID,
    label: str = "applicant",
) -> dict[str, Any]:
    """Somebody who found the Job themselves and applied, which no link may claim."""
    await a_candidate_who_can_apply(browser, mailbox, session, label)
    landed = await read_public_job(browser, str(job_id))
    assert landed.status_code == 200, landed.text
    return await an_accepted_application(browser, job_id)


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


async def sweep_the_job(
    recruiter: AsyncClient,
    job_id: str | UUID,
    statuses: list[ApplicationStatus | str],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
    **reading: Any,
) -> Response:
    """One sweep of the Job's Applications: the ticks, where they go, and whatever the list was
    narrowed by. Ending them is the default, being the sweep this Job's list opens with."""
    return await recruiter.post(
        f"{TENANT_JOBS}/{job_id}/applications/sweep",
        json={"statuses": [str(status) for status in statuses], "to": str(to), **reading},
    )


async def a_swept_job(
    recruiter: AsyncClient,
    job_id: str | UUID,
    statuses: list[ApplicationStatus | str],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
    **reading: Any,
) -> dict[str, Any]:
    response = await sweep_the_job(recruiter, job_id, statuses, to=to, **reading)
    assert response.status_code == 200, response.text
    swept: dict[str, Any] = response.json()
    return swept


async def sweep_the_tenant(
    recruiter: AsyncClient,
    statuses: list[ApplicationStatus | str],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
    **reading: Any,
) -> Response:
    """The same act across every Job the Tenant is hiring for, carrying the Tenant-wide Reading."""
    return await recruiter.post(
        f"{TENANT_APPLICATIONS}/sweep",
        json={"statuses": [str(status) for status in statuses], "to": str(to), **reading},
    )


async def a_swept_tenant(
    recruiter: AsyncClient,
    statuses: list[ApplicationStatus | str],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
    **reading: Any,
) -> dict[str, Any]:
    response = await sweep_the_tenant(recruiter, statuses, to=to, **reading)
    assert response.status_code == 200, response.text
    swept: dict[str, Any] = response.json()
    return swept


async def move_the_ticked(
    recruiter: AsyncClient,
    ids: list[str | UUID],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
) -> Response:
    """One request carrying every tick. Ending them is the default, as the sweeps' is."""
    return await recruiter.post(
        f"{TENANT_APPLICATIONS}/ticked",
        json={"ids": [str(one) for one in ids], "to": str(to)},
    )


async def the_ticked_moved(
    recruiter: AsyncClient,
    ids: list[str | UUID],
    *,
    to: ApplicationStatus | str = ApplicationStatus.REJECTED,
) -> dict[str, Any]:
    response = await move_the_ticked(recruiter, ids, to=to)
    assert response.status_code == 200, response.text
    moved: dict[str, Any] = response.json()
    return moved


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
    recruiter: AsyncClient,
    application_id: str | UUID,
    status: ApplicationStatus | str,
    *,
    start_date: date | str | None = None,
) -> Response:
    """A `hired` move needs the day the work started, so one is supplied unless the caller
    names its own — a test about the pipeline should not have to care which day it was."""
    change: dict[str, Any] = {"status": str(status)}
    if start_date is not None:
        change["start_date"] = str(start_date)
    elif str(status) == ApplicationStatus.HIRED.value:
        change["start_date"] = str(A_START_DATE)
    return await recruiter.patch(f"{TENANT_APPLICATIONS}/{application_id}", json=change)


async def a_moved_application(
    recruiter: AsyncClient,
    application_id: str | UUID,
    status: ApplicationStatus | str,
    *,
    start_date: date | str | None = None,
) -> dict[str, Any]:
    response = await move_to(recruiter, application_id, status, start_date=start_date)
    assert response.status_code == 200, response.text
    moved: dict[str, Any] = response.json()
    return moved


async def answer_the_hire(
    browser: AsyncClient, application_id: str | UUID, *, confirmed: bool
) -> Response:
    return await browser.post(
        f"{APPLICATIONS}/{application_id}/hire", json={"confirmed": confirmed}
    )


async def an_answered_hire(
    browser: AsyncClient, application_id: str | UUID, *, confirmed: bool
) -> dict[str, Any]:
    response = await answer_the_hire(browser, application_id, confirmed=confirmed)
    assert response.status_code == 200, response.text
    answered: dict[str, Any] = response.json()
    return answered


async def list_hire_claims(recruiter: AsyncClient, **params: Any) -> Response:
    return await recruiter.get(TENANT_HIRE_CLAIMS, params=params)


async def tenant_hire_claims(recruiter: AsyncClient, **params: Any) -> dict[str, Any]:
    response = await list_hire_claims(recruiter, **params)
    assert response.status_code == 200, response.text
    page: dict[str, Any] = response.json()
    return page


async def hire_claim_of(session: AsyncSession, application_id: str | UUID) -> HireClaim | None:
    session.expire_all()
    return await session.get(HireClaim, UUID(str(application_id)))


async def placements(session: AsyncSession) -> list[UUID]:
    """Every Placement the platform has, read through the view that defines one."""
    session.expire_all()
    rows = await session.execute(text("select application_id from placements"))
    return [row[0] for row in rows]


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


async def the_telling_comes(session: AsyncSession, application_id: str | UUID) -> None:
    """Three days on, without waiting three days.

    Everything the rejection held to its Telling is pulled back to a moment that has passed —
    the Application's own, the Notification's and the queued email's — because they are one
    moment and a test that moved only one of them would be testing a state the platform
    cannot reach.
    """
    identifier = UUID(str(application_id))
    a_moment_ago = func.now() - text("interval '1 second'")
    await session.execute(
        update(Application)
        .where(Application.id == identifier, Application.told_at.is_not(None))
        .values(told_at=a_moment_ago)
    )
    await session.execute(
        update(Notification)
        .where(Notification.application_id == identifier, Notification.visible_at.is_not(None))
        .values(visible_at=a_moment_ago)
    )
    await session.execute(
        update(Communication)
        .where(Communication.application_id == identifier, Communication.available_at.is_not(None))
        .values(available_at=a_moment_ago)
    )
    await session.commit()


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


async def notifications_of(session: AsyncSession, application_id: str | UUID) -> list[Notification]:
    session.expire_all()
    rows = await session.scalars(
        select(Notification)
        .where(Notification.application_id == UUID(str(application_id)))
        .order_by(Notification.created_at)
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
