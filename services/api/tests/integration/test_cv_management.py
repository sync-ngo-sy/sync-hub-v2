from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.cvs import MAX_ACTIVE_CVS
from sync_core import Database, Storage
from sync_core.models import Candidate, CvParsingStatus
from sync_parsers import UnreadableCvError
from tests.support.applications import (
    a_candidate_with_a_stored_cv,
    a_reviewed_application,
    an_accepted_application,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import (
    CVS,
    a_cv,
    a_read_cv,
    an_uploaded_cv,
    cv_object_count,
    cv_row,
    delete_cv,
    make_current,
    my_cvs,
    some_bytes,
    stored_bytes,
    upload_cv,
)
from tests.support.extractors import FakeExtractor
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications
from tests.support.profiles import (
    a_filled_profile,
    a_saved_profile,
    completed_at,
    embedding_jobs,
    give_a_current_cv,
    make_no_cv_current,
    my_id,
)
from tests.support.tenants import an_admin
from tests.support.worker import an_ingestion_worker

A_UUID = "8ad0e2f0-0000-4000-8000-000000000000"


async def test_the_list_holds_every_cv_and_how_far_its_parse_has_got(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    read = await a_read_cv(browser, database, storage, some_bytes("read"))
    waiting = await an_uploaded_cv(browser, some_bytes("waiting"))

    listed = await my_cvs(browser)

    assert [(cv["id"], cv["parsing_status"], cv["is_current"]) for cv in listed] == [
        (waiting["id"], CvParsingStatus.UPLOADED, False),
        (read["id"], CvParsingStatus.READY, True),
    ]


async def test_the_list_says_why_a_parse_failed(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    unreadable = FakeExtractor(UnreadableCvError("this is a photograph of a cat"))
    failed = await a_read_cv(browser, database, storage, extractor=unreadable)

    listed = await my_cvs(browser)

    assert [(cv["id"], cv["parsing_status"]) for cv in listed] == [
        (failed["id"], CvParsingStatus.FAILED)
    ]
    assert listed[0]["parsing_error"]


async def test_the_list_is_only_the_callers_own_cvs(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox, "amina")
    mine = await an_uploaded_cv(browser)
    await a_signed_in_candidate(other_browser, mailbox, "bashir")
    await an_uploaded_cv(other_browser)

    assert [cv["id"] for cv in await my_cvs(browser)] == [mine["id"]]


async def test_a_candidate_who_has_uploaded_nothing_has_an_empty_list(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    assert await my_cvs(browser) == []


async def test_making_a_read_cv_current_moves_the_candidate_over(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    first = await a_read_cv(browser, database, storage, some_bytes("first"))
    second = await a_read_cv(browser, database, storage, some_bytes("second"))

    switched = await make_current(browser, second["id"])

    assert switched.status_code == 200, switched.text
    assert switched.json()["is_current"] is True
    assert (await a_cv(browser, first["id"]))["is_current"] is False
    db_session.expire_all()
    candidate = await db_session.get(Candidate, candidate_id)
    assert candidate is not None
    assert str(candidate.current_cv_id) == second["id"]


async def test_making_a_cv_current_finishes_a_profile_that_was_only_waiting_for_one(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    """Switching CVs is a completeness answer, not only a preference."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    cv = await a_read_cv(browser, database, storage)
    await a_saved_profile(browser, a_filled_profile())
    await make_no_cv_current(db_session, candidate_id)
    assert await completed_at(db_session, candidate_id) is None

    switched = await make_current(browser, cv["id"])

    assert switched.status_code == 200, switched.text
    assert await completed_at(db_session, candidate_id) is not None


async def test_making_the_current_cv_current_again_changes_nothing(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    """Not even a re-embedding: every write to the candidate row enqueues one."""
    await a_signed_in_candidate(browser, mailbox)
    only = await a_read_cv(browser, database, storage)
    candidate_id = await my_id(browser)
    before = (await embedding_jobs(db_session, candidate_id))[0].revision

    again = await make_current(browser, only["id"])

    assert again.status_code == 200, again.text
    assert again.json()["is_current"] is True
    assert (await embedding_jobs(db_session, candidate_id))[0].revision == before


async def test_a_cv_still_being_read_cannot_be_made_current(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    waiting = await an_uploaded_cv(browser)

    refused = await make_current(browser, waiting["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"].endswith("cv-not-ready")


async def test_a_cv_whose_parse_failed_cannot_be_made_current(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    unreadable = FakeExtractor(UnreadableCvError("scanned"))
    failed = await a_read_cv(browser, database, storage, extractor=unreadable)

    refused = await make_current(browser, failed["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"].endswith("cv-not-ready")


async def test_another_candidates_cv_cannot_be_made_current(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox, "amina")
    mine = await a_read_cv(browser, database, storage)
    await a_signed_in_candidate(other_browser, mailbox, "bashir")

    refused = await make_current(other_browser, mine["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"].endswith("cv-not-found")


async def test_deleting_the_current_cv_is_refused_and_says_what_to_do_instead(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    current = await a_read_cv(browser, database, storage)

    refused = await delete_cv(browser, current["id"])

    assert refused.status_code == 409, refused.text
    problem = refused.json()
    assert problem["type"].endswith("cv-is-current")
    assert "current" in problem["detail"]
    assert (await cv_row(db_session, current["id"])).deleted_at is None


async def test_deleting_a_cv_that_is_not_current_takes_it_off_the_list(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    current = await a_read_cv(browser, database, storage, some_bytes("current"))
    spare = await a_read_cv(browser, database, storage, some_bytes("spare"))

    deleted = await delete_cv(browser, spare["id"])

    assert deleted.status_code == 204, deleted.text
    assert [cv["id"] for cv in await my_cvs(browser)] == [current["id"]]
    assert (await cv_row(db_session, spare["id"])).deleted_at is not None


async def test_a_deleted_cv_is_gone_for_its_owner(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await a_read_cv(browser, database, storage, some_bytes("current"))
    spare = await a_read_cv(browser, database, storage, some_bytes("spare"))
    assert (await delete_cv(browser, spare["id"])).status_code == 204

    assert (await browser.get(f"{CVS}/{spare['id']}")).status_code == 404
    assert (await browser.get(f"{CVS}/{spare['id']}/download")).status_code == 404
    assert (await make_current(browser, spare["id"])).status_code == 404
    assert (await delete_cv(browser, spare["id"])).status_code == 404


async def test_the_database_refuses_deleting_the_current_cv(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    current = await a_read_cv(browser, database, storage)

    with pytest.raises(IntegrityError):
        await db_session.execute(
            text("update cvs set deleted_at = now() where id = :cv_id"), {"cv_id": current["id"]}
        )
    await db_session.rollback()


async def test_the_database_refuses_a_deleted_cv_as_the_current_one(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await a_read_cv(browser, database, storage, some_bytes("current"))
    spare = await a_read_cv(browser, database, storage, some_bytes("spare"))
    assert (await delete_cv(browser, spare["id"])).status_code == 204

    with pytest.raises(IntegrityError):
        await db_session.execute(
            text("update candidates set current_cv_id = :cv_id where id = :candidate_id"),
            {"cv_id": spare["id"], "candidate_id": await my_id(browser)},
        )
    await db_session.rollback()


async def test_deleting_a_cv_leaves_the_file_where_it_is(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    storage: Storage,
) -> None:
    """The Applications a Tenant reviews point at it, so the object outlives the candidate's
    list."""
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("still there")
    spare = await an_uploaded_cv(browser, content)

    assert (await delete_cv(browser, spare["id"])).status_code == 204

    assert await stored_bytes(storage, db_session, spare["id"]) == content


async def test_a_cv_an_application_holds_stays_whole_for_the_tenant(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    web: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await give_a_current_cv(db_session, await my_id(other_browser))

    assert (await delete_cv(other_browser, cv_id)).status_code == 204

    review = await a_reviewed_application(recruiter, application["id"])
    assert review["cv"]["id"] == str(cv_id)
    fetched = await web.get(review["cv"]["download_url"])
    assert fetched.status_code == 200, fetched.text
    assert fetched.content.startswith(b"%PDF")


async def test_deleting_a_failed_cv_frees_the_file_to_be_uploaded_again(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("second attempt")
    unreadable = FakeExtractor(UnreadableCvError("scanned"))
    failed = await a_read_cv(browser, database, storage, content, extractor=unreadable)
    refused = await upload_cv(browser, content)
    assert refused.status_code == 409, refused.text

    assert (await delete_cv(browser, failed["id"])).status_code == 204

    again = await upload_cv(browser, content)
    assert again.status_code == 201, again.text
    assert again.json()["id"] != failed["id"]


async def test_the_cap_refuses_one_cv_too_many(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)
    for index in range(MAX_ACTIVE_CVS):
        kept = await upload_cv(browser, some_bytes(f"cv-{index}"))
        assert kept.status_code == 201, kept.text

    refused = await upload_cv(browser, some_bytes("one too many"))

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"].endswith("cv-limit-reached")
    assert len(await my_cvs(browser)) == MAX_ACTIVE_CVS


async def test_deleting_a_cv_makes_room_for_another(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)
    uploaded = [await an_uploaded_cv(browser, some_bytes(f"cv-{i}")) for i in range(MAX_ACTIVE_CVS)]
    assert (await delete_cv(browser, uploaded[0]["id"])).status_code == 204

    room = await upload_cv(browser, some_bytes("in the freed slot"))

    assert room.status_code == 201, room.text
    assert len(await my_cvs(browser)) == MAX_ACTIVE_CVS


async def test_two_uploads_at_once_cannot_both_take_the_last_slot(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    for index in range(MAX_ACTIVE_CVS - 1):
        assert (await upload_cv(browser, some_bytes(f"cv-{index}"))).status_code == 201

    first, second = await asyncio.gather(
        upload_cv(browser, some_bytes("racing one")), upload_cv(browser, some_bytes("racing two"))
    )

    assert sorted([first.status_code, second.status_code]) == [201, 409], (first.text, second.text)
    refused = first if first.status_code == 409 else second
    assert refused.json()["type"].endswith("cv-limit-reached")
    assert len(await my_cvs(browser)) == MAX_ACTIVE_CVS
    assert await cv_object_count(db_session) == MAX_ACTIVE_CVS  # the loser took its file with it


async def test_deleting_a_cv_while_it_is_being_made_current_settles_one_way(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    """Whichever wins, the candidate is never left with a deleted CV as their current one."""
    await a_signed_in_candidate(browser, mailbox)
    await a_read_cv(browser, database, storage, some_bytes("current"))
    spare = await a_read_cv(browser, database, storage, some_bytes("spare"))

    switched, deleted = await asyncio.gather(
        make_current(browser, spare["id"]), delete_cv(browser, spare["id"])
    )

    outcomes = (switched.status_code, deleted.status_code)
    assert outcomes in {(200, 409), (404, 204)}, (switched.text, deleted.text)
    row = await cv_row(db_session, spare["id"])
    assert (row.deleted_at is None) == (outcomes == (200, 409))
    assert [cv["is_current"] for cv in await my_cvs(browser)].count(True) == 1


async def test_a_cv_deleted_while_it_was_being_read_never_becomes_current(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    uploaded = await an_uploaded_cv(browser)
    assert (await delete_cv(browser, uploaded["id"])).status_code == 204

    assert await an_ingestion_worker(database, storage, FakeExtractor()).run_once() is True

    assert (await cv_row(db_session, uploaded["id"])).parsing_status is CvParsingStatus.READY
    db_session.expire_all()
    candidate = await db_session.get(Candidate, candidate_id)
    assert candidate is not None
    assert candidate.current_cv_id is None


async def test_a_cv_deleted_while_it_was_being_read_fails_without_telling_anyone(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    uploaded = await an_uploaded_cv(browser)
    assert (await delete_cv(browser, uploaded["id"])).status_code == 204
    unreadable = FakeExtractor(UnreadableCvError("this is a photograph of a cat"))

    assert await an_ingestion_worker(database, storage, unreadable).run_once() is True

    assert (await cv_row(db_session, uploaded["id"])).parsing_status is CvParsingStatus.FAILED
    assert await my_notifications(browser) == []


@pytest.mark.parametrize(
    "method,path",
    [("get", CVS), ("post", f"{CVS}/{A_UUID}/make-current"), ("delete", f"{CVS}/{A_UUID}")],
)
async def test_managing_cvs_needs_a_session(browser: AsyncClient, method: str, path: str) -> None:
    response = await getattr(browser, method)(path)

    assert response.status_code == 401, response.text


async def test_a_recruiter_has_no_cvs_to_manage(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)

    response = await browser.get(CVS)

    assert response.status_code == 403, response.text
    assert response.json()["type"].endswith("candidate-only")
