"""Every Application is read as it arrives, and nobody presses anything to make it happen.

The reading runs in the worker rather than in the request that created the Application: a
Candidate does not wait on a model, and a provider that is down cannot refuse an Application.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import delete, select, text
from sqlalchemy.dialects import postgresql

from sync_api.app import create_app
from sync_api.applications.ordering import ORDERINGS
from sync_api.applications.payload import ApplicationSort
from sync_api.applications.review import _with_what_a_summary_shows
from sync_api.pagination import ordered_by
from sync_assessments import ApplicationGoneError, AssessmentError, MatchAssessing
from sync_core.models import (
    Application,
    ApplicationProfileSnapshot,
    AssessmentStatus,
    MatchAssessmentJob,
)
from tests.support.applications import (
    A_YES_NO_QUESTION,
    a_candidate_with_a_ready_cv,
    a_job_screening_on,
    an_accepted_application,
    job_applications_of,
    list_job_applications,
    qualification_history_of,
    questions_of,
    stored_application,
)
from tests.support.assessments import (
    an_assessment,
    assessment_job,
    assessment_url,
    match_score_of,
    stored_assessments,
    the_assessment_of,
)
from tests.support.assessors import MODEL, FakeAssessor
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.profiles import AN_EDUCATION, AN_EXPERIENCE, a_profile, a_saved_profile
from tests.support.tenants import an_admin
from tests.support.worker import an_assessment_worker

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Settings
    from tests.support.mailbox import Mailbox

A_JOBS_CRITERIA: dict[str, Any] = {
    "minimum_total_experience_years": 5.0,
    "skills": [
        {"name": "Python", "importance": "required", "minimum_years": 5},
        {"name": "Rust", "importance": "required", "minimum_years": None},
    ],
    "languages": [{"code": "ar", "minimum_proficiency": "fluent"}],
    "questions": [A_YES_NO_QUESTION],
}

AN_APPLICANTS_PROFILE: dict[str, Any] = a_profile(
    headline="Backend engineer, 8 years",
    summary="Builds payment systems that stay up.",
    phone="+963115550100",
    phone_country="SY",
    location_key="sy-damascus",
    canonical_role_key="backend-engineer",
    experiences=[AN_EXPERIENCE],
    educations=[AN_EDUCATION],
    skills=[{"name": "Python", "years_experience": 8.0}],
    languages=[{"code": "ar", "proficiency": "native"}],
)

#: The Job asks for Python and Rust; the Snapshot evidences only Python.
HALF_THE_REQUIRED_SKILLS = 50.0


class UnreachableModel:
    """A provider that is down. Worth waiting for, so the queue keeps the row and tries again."""

    model = MODEL

    def __init__(self) -> None:
        self.calls = 0

    async def assess(self, request: object) -> Any:
        self.calls += 1
        raise AssessmentError("the provider answered 503")


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
    job = await a_job_screening_on(recruiter, **A_JOBS_CRITERIA)
    await a_candidate_with_a_ready_cv(applicant, mailbox, session)
    await a_saved_profile(applicant, AN_APPLICANTS_PROFILE)
    [question] = questions_of(job)
    return await an_accepted_application(
        applicant,
        job["id"],
        answers=[{"question_id": question["id"], "answer_boolean": True}],
    )


async def test_applying_enqueues_the_reading_without_running_it(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    assessor: FakeAssessor,
) -> None:
    """The request that creates the Application never waits on a model."""
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    queued = await assessment_job(db_session, application["id"])

    assert queued.status is AssessmentStatus.PENDING
    assert queued.attempts == 0
    assert assessor.call_count == 0, "the submission called the model inline"
    assert await stored_assessments(db_session, application["id"]) == []


async def test_the_worker_reads_it_and_the_application_carries_the_score(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)

    assert await an_assessment_worker(database, assessor).run_once() is True

    [written] = await stored_assessments(db_session, application["id"])
    assert float(written.match_percentage) == HALF_THE_REQUIRED_SKILLS
    assert written.model_name == MODEL
    assert (await assessment_job(db_session, application["id"])).status is (
        AssessmentStatus.COMPLETED
    )
    assert await match_score_of(db_session, application["id"]) == HALF_THE_REQUIRED_SKILLS


async def test_the_reading_is_taken_from_the_snapshot_and_the_jobs_criteria(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    """The same document the Recruiter's own request would have shown the model."""
    await an_application_to(recruiter, applicant, mailbox, db_session)

    await an_assessment_worker(database, assessor).run_once()

    read = assessor.last()
    assert [skill.name for skill in read.job.skills] == ["Python", "Rust"]
    assert [language.name for language in read.job.languages] == ["Arabic"]
    assert read.application.headline == "Backend engineer, 8 years"
    assert [skill.name for skill in read.application.skills] == ["Python"]
    assert [answer.answer for answer in read.application.answers] == ["yes"]


async def test_a_reading_leaves_the_screening_verdict_exactly_as_it_found_it(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    """Advice is advice. Screening decided before any model was asked, and stays decided."""
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    before = await stored_application(db_session, application["id"])
    verdict, reason = before.qualification_status, before.qualification_reason
    decided = len(await qualification_history_of(db_session, application["id"]))

    await an_assessment_worker(database, assessor).run_once()

    after = await stored_application(db_session, application["id"])
    assert after.qualification_status is verdict
    assert after.qualification_reason == reason
    assert len(await qualification_history_of(db_session, application["id"])) == decided


async def test_asking_again_replaces_the_reading_rather_than_adding_one(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    """An Application carries one reading. A Recruiter who distrusts it gets a better one, not
    a longer list to read through."""
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    await an_assessment_worker(database, assessor).run_once()
    [automatic] = await stored_assessments(db_session, application["id"])

    asked = await an_assessment(recruiter, application["id"])

    [only] = await stored_assessments(db_session, application["id"])
    replaced, first_read = only.id, only.created_at
    last_read, percentage = only.updated_at, float(only.match_percentage)

    assert replaced == automatic.id, "replaced in place rather than written beside"
    assert asked["id"] == str(automatic.id)
    assert last_read > first_read, "the reading says when it was last read"
    assert await match_score_of(db_session, application["id"]) == percentage


async def test_the_reading_is_readable_back_on_its_own(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    assert await the_assessment_of(recruiter, application["id"]) is None

    await an_assessment_worker(database, assessor).run_once()

    read = await the_assessment_of(recruiter, application["id"])
    assert read is not None
    assert read["match_percentage"] == HALF_THE_REQUIRED_SKILLS
    assert read["model_name"] == MODEL
    assert read["assessed_at"] == read["first_assessed_at"], "read once, so far"


async def test_nothing_takes_a_reading_away_once_an_application_has_one(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> None:
    """A Recruiter who distrusts a number asks for a better one. There is no way to be left
    with an empty column, which is what keeps a Job's list sortable all the way down."""
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    await an_assessment_worker(database, assessor).run_once()
    [written] = await stored_assessments(db_session, application["id"])

    refused = await recruiter.delete(f"{assessment_url(application['id'])}/{written.id}")

    assert refused.status_code in (404, 405), refused.text
    assert len(await stored_assessments(db_session, application["id"])) == 1
    assert await match_score_of(db_session, application["id"]) is not None


async def test_a_provider_that_is_down_keeps_the_row_and_writes_no_reading(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    unreachable = UnreachableModel()

    await an_assessment_worker(database, unreachable, max_attempts=3).run_once()

    queued = await assessment_job(db_session, application["id"])
    assert queued.status is AssessmentStatus.PENDING
    assert queued.attempts == 1
    assert await stored_assessments(db_session, application["id"]) == []
    assert await match_score_of(db_session, application["id"]) is None


async def test_a_provider_that_stays_down_gives_up_and_the_application_shows_no_score(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    """An Application with no Match score is one nobody has read, which is the truth."""
    application = await an_application_to(recruiter, applicant, mailbox, db_session)
    unreachable = UnreachableModel()
    worker = an_assessment_worker(database, unreachable, max_attempts=2)

    await worker.run_once()
    await worker.run_once()

    queued = await assessment_job(db_session, application["id"])
    assert queued.status is AssessmentStatus.FAILED
    assert await worker.run_once() is False, "a settled job must not be claimable again"
    assert await match_score_of(db_session, application["id"]) is None


async def test_reading_an_application_that_is_not_there_is_settled_rather_than_retried(
    database: Database, assessor: FakeAssessor
) -> None:
    """What the worker turns into a permanent failure: nothing to read, and no number of
    attempts will make one appear."""
    with pytest.raises(ApplicationGoneError):
        await MatchAssessing(database, assessor).assess(uuid4())

    assert assessor.call_count == 0


# ── Sorting a Job's Applications by Match score ───────────────────────────────────────────


@pytest.fixture
async def other_applicant(assessing: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(assessing, headers=SPA_HEADERS) as browser:
        yield browser


@pytest.fixture
async def third_applicant(assessing: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(assessing, headers=SPA_HEADERS) as browser:
        yield browser


async def applied_to(
    job: dict[str, Any],
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    label: str,
    skills: list[dict[str, Any]],
) -> dict[str, Any]:
    await a_candidate_with_a_ready_cv(browser, mailbox, session, label)
    await a_saved_profile(browser, {**AN_APPLICANTS_PROFILE, "skills": skills})
    [question] = questions_of(job)
    return await an_accepted_application(
        browser, job["id"], answers=[{"question_id": question["id"], "answer_boolean": True}]
    )


PYTHON_ONLY: list[dict[str, Any]] = [{"name": "Python", "years_experience": 8.0}]
BOTH_SKILLS: list[dict[str, Any]] = [
    {"name": "Python", "years_experience": 8.0},
    {"name": "Rust", "years_experience": 3.0},
]


@dataclass(frozen=True, slots=True)
class ThreeWays:
    """One Job read three ways: a full answer, a half one, and one nobody has read."""

    job: dict[str, Any]
    whole: str
    half: str
    unread: str


@pytest.fixture
async def three_ways(
    recruiter: AsyncClient,
    applicant: AsyncClient,
    other_applicant: AsyncClient,
    third_applicant: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    assessor: FakeAssessor,
) -> ThreeWays:
    job = await a_job_screening_on(recruiter, **A_JOBS_CRITERIA)
    half = await applied_to(job, applicant, mailbox, db_session, "half", PYTHON_ONLY)
    whole = await applied_to(job, other_applicant, mailbox, db_session, "whole", BOTH_SKILLS)
    unread = await applied_to(job, third_applicant, mailbox, db_session, "unread", PYTHON_ONLY)

    worker = an_assessment_worker(database, assessor)
    await worker.run_once()
    await worker.run_once()
    await _abandon_the_reading(db_session, unread["id"])

    return ThreeWays(job=job, whole=whole["id"], half=half["id"], unread=unread["id"])


async def _abandon_the_reading(session: AsyncSession, application_id: str) -> None:
    """The third Application's reading never happens — a provider that stayed down."""
    await session.execute(
        delete(MatchAssessmentJob).where(
            MatchAssessmentJob.application_id == UUID(str(application_id))
        )
    )
    await session.commit()


async def test_the_best_answered_application_is_read_first(
    recruiter: AsyncClient, three_ways: ThreeWays
) -> None:
    """And an Application nobody has read sorts below every one that has, rather than as a zero."""
    listed = await job_applications_of(recruiter, three_ways.job["id"], sort="highest_match")

    assert [row["id"] for row in listed] == [
        three_ways.whole,
        three_ways.half,
        three_ways.unread,
    ]


async def test_the_weakest_reading_is_read_first_from_the_other_end(
    recruiter: AsyncClient, three_ways: ThreeWays
) -> None:
    listed = await job_applications_of(recruiter, three_ways.job["id"], sort="lowest_match")

    assert [row["id"] for row in listed] == [
        three_ways.unread,
        three_ways.half,
        three_ways.whole,
    ]


async def test_a_row_carries_the_words_behind_its_score(
    recruiter: AsyncClient, three_ways: ThreeWays
) -> None:
    """A number a Recruiter cannot check is a number they should not be acting on."""
    listed = {row["id"]: row for row in await job_applications_of(recruiter, three_ways.job["id"])}

    read = listed[three_ways.whole]["match"]
    assert read["percentage"] == 100.0
    assert read["explanation"]
    assert read["model_name"] == MODEL
    assert read["assessed_at"]
    assert listed[three_ways.unread]["match"] is None


async def test_the_score_order_pages_from_its_own_cursor(
    recruiter: AsyncClient, three_ways: ThreeWays
) -> None:
    job_id = three_ways.job["id"]
    first = await list_job_applications(recruiter, job_id, sort="highest_match", limit=1)
    cursor = first.json()["next_cursor"]
    assert [row["id"] for row in first.json()["items"]] == [three_ways.whole]
    assert cursor is not None

    rest = await job_applications_of(
        recruiter, job_id, sort="highest_match", limit=2, cursor=cursor
    )

    assert [row["id"] for row in rest] == [three_ways.half, three_ways.unread]


async def test_a_cursor_from_the_date_order_does_not_resume_the_score_order(
    recruiter: AsyncClient, three_ways: ThreeWays
) -> None:
    """Following it would serve a page of the wrong list rather than the next one."""
    job_id = three_ways.job["id"]
    newest = await list_job_applications(recruiter, job_id, limit=1)

    wrong = await list_job_applications(
        recruiter, job_id, sort="highest_match", limit=1, cursor=newest.json()["next_cursor"]
    )

    assert wrong.status_code == 422


async def test_the_score_order_is_served_by_its_index(db_session: AsyncSession) -> None:
    """A Job with hundreds of Applications sorts on an index, not in memory.

    The order runs on an expression, and an expression index only matches an expression spelled
    the same way. A bound parameter reads identically in Python and matches nothing in Postgres,
    so this asks the planner rather than the source: with a sequential scan and a sort both
    discouraged, a plan that still names the index is a plan the index can serve.
    """
    # The query the service issues, joins and all — an index that serves a bare select over one
    # table proves nothing about the list a Recruiter actually reads.
    query = ordered_by(
        _with_what_a_summary_shows(
            select(Application.id, ApplicationProfileSnapshot.full_name)
        ).where(Application.job_id == uuid4()),
        ordering=ORDERINGS[ApplicationSort.HIGHEST_MATCH],
        id_=Application.id,
        cursor=None,
        limit=20,
    )
    sql = str(query.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))

    await db_session.execute(text("set local enable_seqscan = off"))
    await db_session.execute(text("set local enable_sort = off"))
    plan = "\n".join((await db_session.execute(text(f"explain {sql}"))).scalars().all())

    assert "applications_job_match_score_idx" in plan, plan
    assert "Sort" not in plan, plan
    await db_session.rollback()
