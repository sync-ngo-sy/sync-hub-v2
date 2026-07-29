from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import func, select

from sync_api.app import create_app
from sync_api.candidates import DELETED_NAME
from sync_core.models import Candidate, Cv, Notification, Profile, User
from tests.support.applications import (
    a_candidate_with_a_stored_cv,
    a_reviewed_application,
    an_accepted_application,
    applications_of,
    snapshot_of,
)
from tests.support.candidates import (
    DEFAULT_PASSWORD,
    a_deleted_account,
    a_signed_in_candidate,
    delete_my_account,
    sign_in,
)
from tests.support.crm import a_searchable_candidate, pool_of, save_to_pool
from tests.support.cvs import CVS, an_uploaded_cv
from tests.support.embedders import FakeEmbedder
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.jobs import a_published_job
from tests.support.notifications import failed_parses
from tests.support.profiles import (
    a_filled_profile,
    a_saved_profile,
    embedding_jobs,
    give_a_current_cv,
    my_id,
    profile_chunks,
    section_row_counts,
)
from tests.support.search import SEARCH, a_candidate_with
from tests.support.tenants import an_admin
from tests.support.worker import a_reembed_worker, drain

if TYPE_CHECKING:
    from collections.abc import AsyncIterator
    from uuid import UUID

    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Settings, Storage
    from tests.support.mailbox import Mailbox

WRONG_PASSWORD: Final = "not-the-right-password"

INVALID_CREDENTIALS: Final = "urn:sync:problem:invalid-credentials"

CANDIDATE_ONLY: Final = "urn:sync:problem:candidate-only"

A_BACKEND_ENGINEER: dict[str, Any] = {
    "headline": "Backend engineer, 8 years",
    "summary": "Builds payment systems in Python and PostgreSQL.",
    "location": "Damascus, Syria",
    "skills": [{"name": "Python", "years_experience": 8.0}],
}


async def stored_profile(session: AsyncSession, candidate_id: UUID) -> Profile:
    session.expire_all()
    profile = await session.get(Profile, candidate_id)
    assert profile is not None, f"no profiles row for {candidate_id}"
    return profile


async def stored_candidate(session: AsyncSession, candidate_id: UUID) -> Candidate:
    session.expire_all()
    candidate = await session.get(Candidate, candidate_id)
    assert candidate is not None, f"no candidates row for {candidate_id}"
    return candidate


async def stored_account(session: AsyncSession, candidate_id: UUID) -> tuple[Profile, Candidate]:
    """Both rows under a single expiry. Reading them one helper at a time would expire the first
    row again and lazy-load it back off the event loop."""
    profile = await stored_profile(session, candidate_id)
    candidate = await session.get(Candidate, candidate_id)
    assert candidate is not None, f"no candidates row for {candidate_id}"
    return profile, candidate


async def banned_until(session: AsyncSession, candidate_id: UUID) -> Any:
    session.expire_all()
    user = await session.get(User, candidate_id)
    assert user is not None, f"no auth.users row for {candidate_id}"
    return user.banned_until


async def cvs_of(session: AsyncSession, candidate_id: UUID) -> list[Cv]:
    session.expire_all()
    rows = await session.scalars(select(Cv).where(Cv.candidate_id == candidate_id))
    return list(rows)


async def notification_count(session: AsyncSession, profile_id: UUID) -> int:
    session.expire_all()
    counted = await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.recipient_profile_id == profile_id)
    )
    return int(counted or 0)


async def test_the_account_survives_the_wrong_password(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)

    response = await delete_my_account(browser, WRONG_PASSWORD)

    assert response.status_code == 401
    assert response.json()["type"] == INVALID_CREDENTIALS
    assert (await stored_profile(db_session, candidate_id)).deleted_at is None
    assert (await browser.get("/v1/auth/me")).status_code == 200


async def test_deleting_the_account_scrubs_the_live_identity(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await a_saved_profile(browser, a_filled_profile(phone="+963 11 111 1111"))

    await a_deleted_account(browser)

    profile, candidate = await stored_account(db_session, candidate_id)
    assert profile.deleted_at is not None
    assert profile.full_name == DELETED_NAME
    assert profile.phone is None
    assert profile.avatar_url is None
    assert candidate.deleted_at is not None
    assert candidate.headline is None
    assert candidate.summary is None
    assert candidate.location is None
    assert candidate.unmapped_skills == []
    assert candidate.is_searchable is False


async def test_deleting_the_account_purges_the_profile_and_its_chunks(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await a_saved_profile(browser, a_filled_profile(is_searchable=True))
    await drain(a_reembed_worker(database, FakeEmbedder()))
    assert await profile_chunks(db_session, candidate_id) != []

    await a_deleted_account(browser)

    assert await section_row_counts(db_session, candidate_id) == {
        "experiences": 0,
        "educations": 0,
        "skills": 0,
        "languages": 0,
        "projects": 0,
    }
    assert await profile_chunks(db_session, candidate_id) == []
    assert await embedding_jobs(db_session, candidate_id) == []


async def test_a_purged_profile_stays_purged_when_the_worker_runs_again(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    """Every purge fires `reembed_on_change`, so the queue must not resurrect the chunks."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await a_saved_profile(browser, a_filled_profile(is_searchable=True))

    await a_deleted_account(browser)
    await drain(a_reembed_worker(database, FakeEmbedder()))

    assert await profile_chunks(db_session, candidate_id) == []


async def test_deleting_the_account_soft_deletes_every_cv(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await an_uploaded_cv(browser)

    await a_deleted_account(browser)

    stored = await cvs_of(db_session, candidate_id)
    assert len(stored) == 2
    assert all(cv.deleted_at is not None for cv in stored)
    assert (await stored_candidate(db_session, candidate_id)).current_cv_id is None


async def test_deleting_the_account_purges_notifications(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await failed_parses(browser, database, storage)
    assert await notification_count(db_session, candidate_id) > 0

    await a_deleted_account(browser)

    assert await notification_count(db_session, candidate_id) == 0


async def test_deleting_the_account_drops_the_candidate_from_every_talent_pool(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    saved = await save_to_pool(recruiter, candidate_id)
    assert saved.status_code == 200, saved.text

    await a_deleted_account(other_browser)

    assert await pool_of(recruiter) == []


async def test_login_and_refresh_fail_after_deletion(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)

    await a_deleted_account(browser)

    assert await banned_until(db_session, candidate_id) is not None
    assert (await browser.post("/v1/auth/refresh")).status_code == 401
    assert (await browser.get("/v1/auth/me")).status_code == 401
    assert (await sign_in(browser, signup)).status_code in {400, 401, 403}


async def test_deleting_an_account_is_only_for_candidates(recruiter: AsyncClient) -> None:
    response = await delete_my_account(recruiter)

    assert response.status_code == 403
    assert response.json()["type"] == CANDIDATE_ONLY


async def test_a_deleted_candidate_cannot_be_read_by_the_candidate_surfaces(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(db_session, await my_id(browser))

    await a_deleted_account(browser)

    assert (await browser.get("/v1/candidates/me/profile")).status_code == 401
    assert (await browser.get(CVS)).status_code == 401
    assert (await browser.get("/v1/notifications")).status_code == 401


class TestGlobalSearch:
    @pytest.fixture
    def embedder(self) -> FakeEmbedder:
        return FakeEmbedder()

    @pytest.fixture
    async def searching(self, settings: Settings, embedder: FakeEmbedder) -> AsyncIterator[FastAPI]:
        app = create_app(settings, embedder=embedder)
        async with LifespanManager(app):
            yield app

    @pytest.fixture
    async def hunting(self, searching: FastAPI, mailbox: Mailbox) -> AsyncIterator[AsyncClient]:
        async with asgi_client(searching, headers=SPA_HEADERS) as browser:
            await an_admin(browser, mailbox)
            yield browser

    async def test_a_deleted_candidate_is_gone_from_global_search(
        self,
        searching: FastAPI,
        hunting: AsyncClient,
        mailbox: Mailbox,
        db_session: AsyncSession,
        database: Database,
        embedder: FakeEmbedder,
    ) -> None:
        amina = await a_candidate_with(
            searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
        )
        await drain(a_reembed_worker(database, embedder))
        found = await hunting.get(SEARCH, params={"q": "backend engineer python"})
        assert [match["candidate_id"] for match in found.json()["items"]] == [str(amina.id)]

        async with asgi_client(searching, headers=SPA_HEADERS) as theirs:
            signed_in = await sign_in(theirs, amina.signup)
            assert signed_in.status_code == 200, signed_in.text
            await a_deleted_account(theirs, amina.signup.password)

        after = await hunting.get(SEARCH, params={"q": "backend engineer python"})
        assert after.status_code == 200, after.text
        assert after.json()["items"] == []


async def test_a_tenant_keeps_the_application_and_snapshot_of_a_deleted_candidate(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    application = await an_accepted_application(other_browser, job["id"])

    await a_deleted_account(other_browser)

    assert len(await applications_of(db_session, candidate_id)) == 1
    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.full_name == "Amina Haddad"
    assert snapshot.experiences != []
    assert snapshot.skills != []
    review = await a_reviewed_application(recruiter, application["id"])
    assert review["snapshot"]["full_name"] == "Amina Haddad"


async def test_the_tenant_can_still_download_the_cv_of_a_deleted_candidate(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    web: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_deleted_account(other_browser)

    review = await a_reviewed_application(recruiter, application["id"])
    fetched = await web.get(review["cv"]["download_url"])
    assert fetched.status_code == 200, fetched.text
    assert fetched.content.startswith(b"%PDF")


async def test_a_deleted_candidate_keeps_the_password_they_confirmed_with(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The scrub never touches the credential, so a wrong password is the only refusal."""
    signup = await a_signed_in_candidate(browser, mailbox)

    refused = await delete_my_account(browser, WRONG_PASSWORD)
    assert refused.status_code == 401

    await a_deleted_account(browser, DEFAULT_PASSWORD)
    assert (await sign_in(browser, signup)).status_code != 200
