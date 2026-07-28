from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from asgi_lifespan import LifespanManager

from sync_api.app import create_app
from sync_assessments import PROMPT_VERSION, AssessmentError
from sync_core.models import SkillImportance
from tests.support.applications import (
    A_YES_NO_QUESTION,
    a_candidate_with_a_ready_cv,
    a_job_screening_on,
    an_accepted_application,
    qualification_history_of,
    questions_of,
    stored_application,
)
from tests.support.assessments import (
    an_assessment,
    assess,
    assessments_of,
    list_assessments,
    stored_assessments,
)
from tests.support.assessors import MODEL, FakeAssessor
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.profiles import a_profile
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings
    from tests.support.mailbox import Mailbox

A_JOBS_CRITERIA: dict[str, Any] = {
    "minimum_total_experience_years": 5.0,
    "skills": [
        {"name": "Python", "importance": "required", "minimum_years": 5},
        {"name": "Rust", "importance": "required", "minimum_years": None},
        {"name": "Docker", "importance": "preferred", "minimum_years": None},
    ],
    "languages": [{"code": "ar", "minimum_proficiency": "fluent"}],
    "questions": [A_YES_NO_QUESTION],
}

AN_APPLICANTS_PROFILE: dict[str, Any] = a_profile(
    headline="Backend engineer, 8 years",
    summary="Builds payment systems that stay up.",
    location="Damascus, Syria",
    experiences=[
        {
            "job_title": "Senior Engineer",
            "company_name": "Acme",
            "start_year": 2018,
            "start_month": 1,
            "end_year": None,
            "end_month": None,
            "is_current": True,
            "description": "Ran the payments ledger.",
        }
    ],
    educations=[
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
            "description": None,
        }
    ],
    skills=[{"name": "Python", "years_experience": 8.0}],
    languages=[{"code": "ar", "proficiency": "native"}],
    projects=[
        {
            "name": "Ledger",
            "description": "Double-entry bookkeeping in Postgres.",
            "project_url": None,
            "repository_url": None,
            "start_year": 2022,
            "start_month": 3,
            "end_year": None,
            "end_month": None,
        }
    ],
)

#: The Job asks for Python and Rust; the Snapshot evidences only Python.
HALF_THE_REQUIRED_SKILLS = 50.0


@pytest.fixture
def assessor() -> FakeAssessor:
    return FakeAssessor()


@pytest.fixture
async def assessing(settings: Settings, assessor: FakeAssessor) -> AsyncIterator[FastAPI]:
    app = create_app(settings, assessor=assessor)
    async with LifespanManager(app):
        yield app


@pytest.fixture
async def recruiter(assessing: FastAPI, mailbox: Mailbox) -> AsyncIterator[AsyncClient]:
    async with asgi_client(assessing, headers=SPA_HEADERS) as browser:
        await an_admin(browser, mailbox)
        yield browser


@pytest.fixture
async def applicant(assessing: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(assessing, headers=SPA_HEADERS) as browser:
        yield browser


async def an_application_to(
    recruiter: AsyncClient, applicant: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, Any]:
    """One Application to one Job that screens on something, ready to be assessed."""
    job = await a_job_screening_on(recruiter, **A_JOBS_CRITERIA)
    cv_id = await a_candidate_with_a_ready_cv(applicant, mailbox, session)
    [question] = questions_of(job)
    return await an_accepted_application(
        applicant,
        job["id"],
        cv_id,
        profile=AN_APPLICANTS_PROFILE,
        answers=[{"question_id": question["id"], "answer_boolean": True}],
    )


async def test_assessing_answers_a_percentage_an_explanation_and_what_ran_it(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    assessment = await an_assessment(recruiter, application["id"])

    assert assessment["match_percentage"] == HALF_THE_REQUIRED_SKILLS
    assert assessment["explanation"] == "Backend engineer, 8 years against Senior Backend Engineer."
    assert assessment["strengths"] == ["Python is evidenced"]
    assert assessment["gaps"] == ["Rust is not listed"]
    assert assessment["model_name"] == MODEL
    assert assessment["prompt_version"] == PROMPT_VERSION
    [stored] = await stored_assessments(db_session, application["id"])
    assert float(stored.match_percentage) == HALF_THE_REQUIRED_SKILLS
    assert stored.model_name == MODEL
    assert stored.prompt_version == PROMPT_VERSION


async def test_the_assessment_reads_the_jobs_criteria_and_the_snapshot_answering_them(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    assessor: FakeAssessor,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    await an_assessment(recruiter, application["id"])

    job, applied = assessor.last().job, assessor.last().application
    assert job.title == "Senior Backend Engineer"
    assert "payment platform" in job.description
    assert float(job.minimum_total_experience_years or 0) == 5.0
    assert [(skill.name, skill.importance, skill.minimum_years) for skill in job.skills] == [
        ("Docker", SkillImportance.PREFERRED, None),
        ("Python", SkillImportance.REQUIRED, 5),
        ("Rust", SkillImportance.REQUIRED, None),
    ]
    assert [(entry.name, entry.minimum_proficiency.value) for entry in job.languages] == [
        ("Arabic", "fluent")
    ]
    assert applied.headline == "Backend engineer, 8 years"
    assert [entry.job_title for entry in applied.experiences] == ["Senior Engineer"]
    assert [entry.institution for entry in applied.educations] == ["Damascus University"]
    assert [(entry.name, float(entry.years_experience or 0)) for entry in applied.skills] == [
        ("Python", 8.0)
    ]
    assert [(entry.name, entry.proficiency.value) for entry in applied.languages] == [
        ("Arabic", "native")
    ]
    assert [entry.name for entry in applied.projects] == ["Ledger"]
    assert [(entry.question, entry.answer) for entry in applied.answers] == [
        (A_YES_NO_QUESTION["question_text"], "yes")
    ]


async def test_it_reads_the_frozen_snapshot_and_never_the_live_profile(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    assessor: FakeAssessor,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    rewritten = await applicant.put(
        "/v1/candidates/me/profile",
        json=a_profile(
            headline="Rust engineer, 10 years",
            skills=[{"name": "Rust", "years_experience": 10.0}],
        ),
    )
    assert rewritten.status_code == 200, rewritten.text

    assessment = await an_assessment(recruiter, application["id"])

    applied = assessor.last().application
    assert applied.headline == "Backend engineer, 8 years"
    assert [entry.name for entry in applied.skills] == ["Python"]
    assert assessment["match_percentage"] == HALF_THE_REQUIRED_SKILLS


async def test_running_it_again_appends_and_the_history_is_newest_first(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    first = await an_assessment(recruiter, application["id"])
    second = await an_assessment(recruiter, application["id"])

    listed = await assessments_of(recruiter, application["id"])
    assert [item["id"] for item in listed] == [second["id"], first["id"]]
    assert first["id"] != second["id"]
    assert len(await stored_assessments(db_session, application["id"])) == 2


async def test_the_history_pages_newest_first(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    first = await an_assessment(recruiter, application["id"])
    second = await an_assessment(recruiter, application["id"])

    page = await list_assessments(recruiter, application["id"], limit=1)
    assert page.status_code == 200, page.text
    newest = page.json()
    following = await assessments_of(
        recruiter, application["id"], limit=1, cursor=newest["next_cursor"]
    )

    assert [item["id"] for item in newest["items"]] == [second["id"]]
    assert [item["id"] for item in following] == [first["id"]]


async def test_no_number_of_assessments_touches_the_screening_verdict(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    before = await stored_application(db_session, application["id"])
    verdict = (before.qualification_status, before.qualification_reason, before.status)

    for _ in range(3):
        await an_assessment(recruiter, application["id"])

    after = await stored_application(db_session, application["id"])
    assert (after.qualification_status, after.qualification_reason, after.status) == verdict
    assert len(await qualification_history_of(db_session, application["id"])) == 1


async def test_another_tenants_recruiter_can_neither_assess_it_nor_read_its_history(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    assessing: FastAPI,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    async with asgi_client(assessing, headers=SPA_HEADERS) as rival:
        await an_admin(rival, mailbox, "rival")
        refused = await assess(rival, application["id"])
        unreadable = await list_assessments(rival, application["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:application-not-found"
    assert unreadable.status_code == 404, unreadable.text
    assert await stored_assessments(db_session, application["id"]) == []


async def test_the_candidate_who_applied_cannot_assess_their_own_application(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    refused = await assess(applicant, application["id"])

    assert refused.status_code == 403, refused.text
    assert await stored_assessments(db_session, application["id"]) == []


async def test_a_model_that_fails_leaves_no_assessment_behind(
    settings: Settings,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    broken = FakeAssessor(failure=AssessmentError("the provider is down"))
    app = create_app(settings, assessor=broken)
    async with (
        LifespanManager(app),
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
        asgi_client(app, headers=SPA_HEADERS) as applicant,
    ):
        await an_admin(recruiter, mailbox)
        application = await an_application_to(recruiter, applicant, mailbox, db_session)

        refused = await assess(recruiter, application["id"])
        history = await assessments_of(recruiter, application["id"])

    assert refused.status_code == 502, refused.text
    assert refused.json()["type"] == "urn:sync:problem:assessment-failed"
    assert history == []
    assert await stored_assessments(db_session, application["id"]) == []


async def test_a_deployment_without_a_model_refuses_to_assess_but_still_reads_the_history(
    settings: Settings,
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    await an_assessment(recruiter, application["id"])

    unconfigured = create_app(settings.model_copy(update={"openai_api_key": None}))
    async with (
        LifespanManager(unconfigured),
        asgi_client(unconfigured, headers=SPA_HEADERS) as reader,
    ):
        await an_admin(reader, mailbox, "unconfigured")
        theirs = await an_application_to(reader, applicant, mailbox, db_session)
        refused = await assess(reader, theirs["id"])
        history = await assessments_of(reader, theirs["id"])

    assert refused.status_code == 503, refused.text
    assert refused.json()["type"] == "urn:sync:problem:assessment-unavailable"
    assert history == []


async def test_assessing_is_rate_limited(
    settings: Settings,
    assessor: FakeAssessor,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    app = create_app(
        settings.model_copy(update={"assessment_rate_limit_max_requests": 1}), assessor=assessor
    )
    async with (
        LifespanManager(app),
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
        asgi_client(app, headers=SPA_HEADERS) as applicant,
    ):
        await an_admin(recruiter, mailbox)
        application = await an_application_to(recruiter, applicant, mailbox, db_session)

        first = await assess(recruiter, application["id"])
        second = await assess(recruiter, application["id"])
        history = await list_assessments(recruiter, application["id"])

    assert first.status_code == 201, first.text
    assert second.status_code == 429, second.text
    assert second.json()["type"] == "urn:sync:problem:rate-limited"
    assert int(second.headers["Retry-After"]) >= 1
    assert history.status_code == 200, history.text
    assert assessor.call_count == 1
