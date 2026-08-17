from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.jobs.visitors import VISITOR_COOKIE
from sync_core import Settings
from tests.support.harness import TEST_HOST, asgi_client, spa_onto
from tests.support.jobs import (
    JOBS,
    a_created_job,
    a_job,
    a_published_job,
    browse,
    change_job,
    counted_again,
    job_views,
    post_job,
    read_public_job,
    set_criteria,
)
from tests.support.tenants import set_tenant_active

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

A_FRONTEND_JOB = {
    "title": "Frontend Engineer",
    "description": "Build the candidate portal in React and TypeScript.",
    "location_key": "sy-aleppo",
    "employment_type": "part_time",
    "work_mode": "remote",
}


@pytest.fixture
async def another_visitor(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(app, headers={"user-agent": "a different browser"}) as anonymous:
        yield anonymous


async def test_a_visitor_reads_published_jobs_and_no_others(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    published = await a_published_job(recruiter)
    draft = await a_created_job(recruiter, title="Still being written")
    closed = await a_published_job(recruiter, title="Filled already")
    await change_job(recruiter, closed["id"], status="closed")

    listed = await browse(visitor)

    assert [item["id"] for item in listed] == [published["id"]]
    assert (await read_public_job(visitor, draft["id"])).status_code == 404
    assert (await read_public_job(visitor, closed["id"])).status_code == 404


async def test_a_published_job_names_the_tenant_hiring(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)

    [listed] = await browse(visitor)

    assert listed["tenant"] == {
        "name": "Acme Recruiting",
        "slug": listed["tenant"]["slug"],
        "logo_url": None,
    }
    assert listed["title"] == job["title"]
    assert listed["location_name"] == "Damascus"


async def test_a_suspended_tenants_jobs_leave_the_board(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    slug = (await recruiter.get("/v1/tenants/me")).json()["slug"]

    await set_tenant_active(db_session, slug, is_active=False)

    assert await browse(visitor) == []
    assert (await read_public_job(visitor, job["id"])).status_code == 404


async def test_a_job_past_its_expiry_leaves_the_board(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    expired = await a_published_job(recruiter, expires_at=yesterday)
    live = await a_published_job(
        recruiter,
        title="Open until December",
        expires_at=(datetime.now(UTC) + timedelta(days=30)).isoformat(),
    )

    assert [item["id"] for item in await browse(visitor)] == [live["id"]]
    assert (await read_public_job(visitor, expired["id"])).status_code == 404


async def test_keywords_narrow_the_board_without_reordering_it(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    backend = await a_published_job(recruiter)
    frontend = await a_published_job(recruiter, **A_FRONTEND_JOB)

    assert [item["id"] for item in await browse(visitor, q="react typescript")] == [frontend["id"]]
    assert [item["id"] for item in await browse(visitor, q="payment platform")] == [backend["id"]]
    assert [item["id"] for item in await browse(visitor, q="engineer")] == [
        frontend["id"],
        backend["id"],
    ]
    assert await browse(visitor, q="veterinary surgeon") == []


async def test_the_location_and_the_employment_type_are_hard_filters(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    backend = await a_published_job(recruiter)
    frontend = await a_published_job(recruiter, **A_FRONTEND_JOB)

    assert [item["id"] for item in await browse(visitor, location_key="sy-damascus")] == [
        backend["id"]
    ]
    assert [item["id"] for item in await browse(visitor, employment_type="part_time")] == [
        frontend["id"]
    ]
    assert (await browse(visitor, location_key="sy-damascus", employment_type="part_time")) == []


async def test_an_employment_type_outside_the_set_is_refused_rather_than_ignored(
    visitor: AsyncClient,
) -> None:
    """A filter the platform has no such kind of job for is a mistake worth naming, not an
    empty page that reads as "nobody is hiring"."""
    response = await visitor.get(JOBS, params={"employment_type": "Part time"})

    assert response.status_code == 422, response.text


async def test_a_published_job_carries_its_employment_type_and_work_mode(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter, **A_FRONTEND_JOB)

    [listed] = await browse(visitor)
    read = await read_public_job(visitor, job["id"])

    assert (listed["employment_type"], listed["work_mode"]) == ("part_time", "remote")
    assert read.json()["employment_type"] == "part_time"
    assert read.json()["work_mode"] == "remote"
    assert read.json()["location_name"] == "Aleppo"


async def test_a_governorate_never_answers_for_the_one_beside_it(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """The bug the taxonomy exists to fix: "Damascus" used to be matched inside the location, so
    a Job in Rif Dimashq — a different governorate — came back for it, and there was no way to
    ask for one without the other."""
    in_damascus = await a_published_job(recruiter, location_key="sy-damascus")
    in_the_countryside = await a_published_job(
        recruiter, title="Field officer", location_key="sy-rif-dimashq"
    )

    assert [item["id"] for item in await browse(visitor, location_key="sy-damascus")] == [
        in_damascus["id"]
    ]
    assert [item["id"] for item in await browse(visitor, location_key="sy-rif-dimashq")] == [
        in_the_countryside["id"]
    ]


async def test_a_place_whose_key_contains_another_is_still_a_different_place(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """The equality, held to the letter. "ma" — Morocco — sits inside "sy-hama", so a filter that
    matched inside the value instead of equalling it would answer either with both."""
    in_hama = await a_published_job(recruiter, location_key="sy-hama")
    in_morocco = await a_published_job(recruiter, title="Field officer", location_key="ma")

    assert [item["id"] for item in await browse(visitor, location_key="ma")] == [in_morocco["id"]]
    assert [item["id"] for item in await browse(visitor, location_key="sy-hama")] == [in_hama["id"]]


async def test_a_job_is_found_by_the_name_of_its_location(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """The Job holds a key now, so the keyword vector has to reach through the relation for the
    word a person would actually type."""
    in_latakia = await a_published_job(recruiter, title="Field officer", location_key="sy-latakia")

    assert [item["id"] for item in await browse(visitor, q="Latakia")] == [in_latakia["id"]]


async def test_a_job_names_the_location_it_holds_the_key_to(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    await a_published_job(recruiter, location_key="sy-latakia")

    (listed,) = await browse(visitor)

    assert listed["location_key"] == "sy-latakia"
    assert listed["location_name"] == "Latakia"


async def test_a_job_cannot_be_put_somewhere_the_platform_does_not_list(
    recruiter: AsyncClient,
) -> None:
    refused = await post_job(recruiter, a_job(location_key="damascus-ish"))

    assert refused.status_code == 422
    assert [error["location"] for error in refused.json()["errors"]] == ["body.location_key"]


async def test_the_board_pages_by_cursor(recruiter: AsyncClient, visitor: AsyncClient) -> None:
    oldest = await a_published_job(recruiter, title="Oldest")
    middle = await a_published_job(recruiter, title="Middle")
    newest = await a_published_job(recruiter, title="Newest")

    first_page = await visitor.get(JOBS, params={"limit": 2})
    body = first_page.json()
    assert [item["id"] for item in body["items"]] == [newest["id"], middle["id"]]

    second_page = await visitor.get(JOBS, params={"limit": 2, "cursor": body["next_cursor"]})
    rest = second_page.json()
    assert [item["id"] for item in rest["items"]] == [oldest["id"]]
    assert rest["next_cursor"] is None


async def test_a_job_carries_what_applying_to_it_will_ask_for(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    await set_criteria(
        recruiter,
        job["id"],
        minimum_total_experience_years=5.0,
        skills=[{"name": "Python", "importance": "required", "minimum_years": 3}],
        languages=[{"code": "en", "minimum_proficiency": "advanced"}],
        questions=[
            {
                "question_text": "Are you legally allowed to work in Syria?",
                "question_type": "yes_no",
                "is_required": True,
                "accepted_boolean_answer": True,
            }
        ],
    )

    response = await read_public_job(visitor, job["id"])

    assert response.status_code == 200, response.text
    read = response.json()
    assert read["description"].startswith("Build and run")
    assert read["minimum_total_experience_years"] == 5.0
    assert read["skills"] == [{"name": "Python", "importance": "required", "minimum_years": 3}]
    assert read["languages"] == [{"code": "en", "minimum_proficiency": "advanced"}]
    assert set(read["questions"][0]) == {"id", "question_text", "question_type", "is_required"}


async def test_which_answer_passes_a_knockout_question_is_never_public(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    await set_criteria(
        recruiter,
        job["id"],
        questions=[
            {
                "question_text": "Do you have a driving licence?",
                "question_type": "yes_no",
                "is_required": True,
                "accepted_boolean_answer": False,
            }
        ],
    )

    response = await read_public_job(visitor, job["id"])

    assert "accepted_boolean_answer" not in response.text


async def test_reading_a_job_records_the_view(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)

    assert (await read_public_job(visitor, job["id"])).status_code == 200

    [view] = await job_views(db_session, job["id"])
    assert view.tracked_link_id is None
    assert view.session_id
    assert view.visitor_hash


async def test_browsing_the_board_is_not_a_view_of_anything(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)

    await browse(visitor)

    assert await job_views(db_session, job["id"]) == []


async def test_a_visitor_keeps_one_session_across_the_jobs_they_read(
    recruiter: AsyncClient,
    visitor: AsyncClient,
    another_visitor: AsyncClient,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    other_job = await a_published_job(recruiter, title="Logistics Officer")

    await read_public_job(visitor, job["id"])
    await read_public_job(visitor, other_job["id"])
    await read_public_job(another_visitor, job["id"])

    first_session, stranger_session = [
        view.session_id for view in await job_views(db_session, job["id"])
    ]
    [again] = await job_views(db_session, other_job["id"])
    assert first_session == again.session_id
    assert stranger_session not in (None, first_session)


async def test_a_refresh_inside_the_window_is_not_a_second_view(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)

    await read_public_job(visitor, job["id"])
    await read_public_job(visitor, job["id"])
    await read_public_job(visitor, job["id"])

    assert len(await job_views(db_session, job["id"])) == 1, "a refresh is not new interest"


async def test_the_same_browser_coming_back_later_is_counted_again(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await read_public_job(visitor, job["id"])
    await counted_again(db_session, job["id"])

    await read_public_job(visitor, job["id"])

    assert len(await job_views(db_session, job["id"])) == 2


async def test_a_view_records_no_address_and_no_browser(
    recruiter: AsyncClient,
    visitor: AsyncClient,
    another_visitor: AsyncClient,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)

    await read_public_job(visitor, job["id"])
    await read_public_job(another_visitor, job["id"])

    known, stranger = await job_views(db_session, job["id"])
    assert known.visitor_hash is not None
    assert len(known.visitor_hash) == 64, "a sha-256 digest, not something readable"
    assert known.visitor_hash != stranger.visitor_hash, "two browsers, two visitors"


async def test_a_session_id_a_visitor_made_up_is_not_the_one_that_is_recorded(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    visitor.cookies.set(VISITOR_COOKIE, "'; drop table job_view_events; --", domain=TEST_HOST)

    await read_public_job(visitor, job["id"])

    [view] = await job_views(db_session, job["id"])
    assert view.session_id is not None
    assert "drop table" not in view.session_id, "a cookie is the visitor's to write, not ours"


async def test_a_job_that_does_not_exist_reads_the_same_as_one_that_is_not_published(
    visitor: AsyncClient,
) -> None:
    response = await read_public_job(visitor, str(uuid4()))

    assert response.status_code == 404, response.text
    assert response.json()["type"] == "urn:sync:problem:job-not-found"


async def test_the_board_is_rate_limited(settings: Settings) -> None:
    async with spa_onto(settings, public_rate_limit_max_requests=2) as spa:
        for _ in range(2):
            assert (await spa.get(JOBS)).status_code == 200

        response = await spa.get(JOBS)

    assert response.status_code == 429, response.text
    assert response.json()["type"] == "urn:sync:problem:rate-limited"
    assert int(response.headers["Retry-After"]) >= 1


async def test_reading_jobs_is_rate_limited_by_the_route_not_the_job(
    recruiter: AsyncClient, settings: Settings
) -> None:
    first = await a_published_job(recruiter, title="One")
    second = await a_published_job(recruiter, title="Two")

    async with spa_onto(settings, public_rate_limit_max_requests=2) as spa:
        assert (await read_public_job(spa, first["id"])).status_code == 200
        assert (await read_public_job(spa, second["id"])).status_code == 200

        refused = await read_public_job(spa, first["id"])

    assert refused.status_code == 429, refused.text
