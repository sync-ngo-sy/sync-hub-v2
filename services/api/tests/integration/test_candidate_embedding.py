from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Database, transaction
from sync_core.models import Candidate, CandidateEmbeddingJob
from sync_rag import EMBEDDING_DIMENSIONS, ChunkType
from tests.support.candidates import a_deleted_account, a_signed_in_candidate
from tests.support.embedders import FakeEmbedder
from tests.support.mailbox import Mailbox
from tests.support.profiles import a_profile, embedding_jobs, my_id, profile_chunks
from tests.support.worker import a_reembed_worker

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

PROFILE = "/v1/candidates/me/profile"

A_FULL_PROFILE: dict[str, Any] = a_profile(
    headline="Backend engineer, 8 years",
    summary="Builds boring payment systems that stay up.",
    location_key="sy-damascus",
    preferred_language_code="ar",
    experiences=[
        {
            "job_title": "Senior Backend Engineer",
            "company_name": "Acme Payments",
            "start_year": 2021,
            "is_current": True,
            "description": "Led the payments ledger rewrite.",
        },
        {
            "job_title": "Backend Engineer",
            "company_name": "Globex",
            "start_year": 2018,
            "end_year": 2021,
        },
    ],
    educations=[
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
        }
    ],
    skills=[
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 7.0},
    ],
    languages=[{"code": "ar", "proficiency": "native"}, {"code": "en", "proficiency": "fluent"}],
    projects=[{"name": "Sync", "description": "A recruitment platform.", "start_year": 2024}],
)


class EditingEmbedder(FakeEmbedder):
    """Edits the profile it is being asked to embed, which is the race the revision guards."""

    def __init__(self, database: Database, candidate_id: UUID) -> None:
        super().__init__()
        self._database = database
        self._candidate_id = candidate_id

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        async with self._database.session() as session, transaction(session):
            await session.execute(
                update(Candidate)
                .where(Candidate.id == self._candidate_id)
                .values(headline="Edited while it was being embedded")
            )
        return await super().embed(texts)


class DeletingEmbedder(FakeEmbedder):
    """Deletes the account while its profile is out at the embedder.

    The provider call is the long half of a re-embed, so this is where a Candidate erasing
    themselves lands: the chunks come back for a profile that no longer exists.
    """

    def __init__(self, browser: AsyncClient) -> None:
        super().__init__()
        self._browser = browser

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        await a_deleted_account(self._browser)
        return await super().embed(texts)


class StolenMidEmbed(FakeEmbedder):
    """Loses its claim mid-flight: the sweeper releases the row and a second worker finishes it.

    Its own model name is what gives it away — chunks carry whichever embedder wrote them.
    """

    model = "a-worker-that-lost-its-claim"

    def __init__(self, session: AsyncSession, database: Database, candidate_id: UUID) -> None:
        super().__init__()
        self._session = session
        self._database = database
        self._candidate_id = candidate_id

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        await _abandon_the_claim(
            self._session, self._candidate_id, claimed_ago=timedelta(minutes=5)
        )
        successor = a_reembed_worker(self._database, FakeEmbedder(), stuck_after_seconds=60)
        assert await successor.sweep() == 1
        assert await successor.run_once() is True, "the successor never claimed the released job"
        return await super().embed(texts)


class LosingItsClaimMidEmbed(FakeEmbedder):
    """Fails, but only once somebody else is holding the claim it was given."""

    def __init__(self, session: AsyncSession, candidate_id: UUID) -> None:
        super().__init__(RuntimeError("the embedder is down"))
        self._session = session
        self._candidate_id = candidate_id

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        await _claimed_by_somebody_else(self._session, self._candidate_id)
        return await super().embed(texts)


async def test_an_account_deleted_while_it_was_embedding_keeps_no_chunks(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    """The one write nothing else undoes. The queue row is gone with the account, so no rebuild
    is ever enqueued to clear these, and the eligibility view hides them from every reader."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    await a_reembed_worker(database, DeletingEmbedder(browser)).run_once()

    assert await profile_chunks(db_session, candidate_id) == []
    assert await embedding_jobs(db_session, candidate_id) == []


async def test_a_worker_whose_claim_was_swept_writes_no_chunks(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    """Two writers on one candidate's chunks is a race on their uniqueness constraint, and the
    loser's vectors describe whatever the profile looked like before the current worker read it."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    stale = StolenMidEmbed(db_session, database, candidate_id)

    await a_reembed_worker(database, stale, stuck_after_seconds=60).run_once()

    chunks = await profile_chunks(db_session, candidate_id)
    assert chunks != []
    assert {chunk.embedding_model for chunk in chunks} == {FakeEmbedder.model}


async def test_a_worker_whose_claim_was_swept_does_not_release_it(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    stale = LosingItsClaimMidEmbed(db_session, candidate_id)

    await a_reembed_worker(database, stale).run_once()

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.claimed_at is not None, "the claim belongs to the worker still working"
    assert job.attempts == 2
    assert job.error_message is None


async def test_a_dirty_profile_becomes_chunks_and_a_clean_job(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    embedder = FakeEmbedder()

    assert await a_reembed_worker(database, embedder).run_once() is True

    chunks = await profile_chunks(db_session, candidate_id)
    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))
    assert {chunk.embedding_model for chunk in chunks} == {embedder.model}
    assert [len(chunk.embedding or []) for chunk in chunks] == [EMBEDDING_DIMENSIONS] * len(chunks)

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is False
    assert job.claimed_at is None
    assert job.attempts == 0
    assert job.error_message is None


async def test_every_section_of_the_profile_becomes_its_own_evidence(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    await a_reembed_worker(database, FakeEmbedder()).run_once()

    chunks = await profile_chunks(db_session, candidate_id)
    written = {chunk.chunk_type: chunk.chunk_text for chunk in chunks}
    assert [chunk.chunk_type for chunk in chunks].count(ChunkType.EXPERIENCE) == 2
    assert set(written) == {
        ChunkType.IDENTITY,
        ChunkType.EXPERIENCE,
        ChunkType.EDUCATION,
        ChunkType.SKILLS,
        ChunkType.LANGUAGES,
        ChunkType.PROJECT,
    }
    assert "Damascus" in written[ChunkType.IDENTITY]
    assert "Damascus University" in written[ChunkType.EDUCATION]
    assert "Python (8 years)" in written[ChunkType.SKILLS]
    assert "Arabic (native)" in written[ChunkType.LANGUAGES]
    assert "Sync" in written[ChunkType.PROJECT]


async def test_a_candidate_who_has_written_nothing_is_only_who_they_are(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)

    assert await a_reembed_worker(database, FakeEmbedder()).run_once() is True

    chunks = await profile_chunks(db_session, candidate_id)
    assert [chunk.chunk_type for chunk in chunks] == [ChunkType.IDENTITY]
    assert chunks[0].chunk_text == "Amina Haddad"
    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is False


async def test_a_section_the_candidate_deletes_loses_its_chunks(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    worker = a_reembed_worker(database, FakeEmbedder())
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    await worker.run_once()

    await browser.put(PROFILE, json=a_profile(headline="Backend engineer, 8 years"))
    await worker.run_once()

    chunks = await profile_chunks(db_session, candidate_id)
    assert [chunk.chunk_type for chunk in chunks] == [ChunkType.IDENTITY]
    assert [chunk.chunk_index for chunk in chunks] == [0]


async def test_an_edit_while_it_was_embedding_leaves_the_job_dirty(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    worker = a_reembed_worker(database, EditingEmbedder(database, candidate_id))

    await worker.run_once()

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is True, "the chunks describe a profile that has already moved on"
    assert job.claimed_at is None
    assert await profile_chunks(db_session, candidate_id) != []

    await a_reembed_worker(database, FakeEmbedder()).run_once()
    [caught_up] = await embedding_jobs(db_session, candidate_id)
    assert caught_up.dirty is False
    identity = (await profile_chunks(db_session, candidate_id))[0]
    assert "Edited while it was being embedded" in identity.chunk_text


async def test_a_failure_keeps_the_job_dirty_and_waits_before_trying_again(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    down = FakeEmbedder(RuntimeError("the embedder is down"))
    worker = a_reembed_worker(database, down, backoff_seconds=60)

    assert await worker.run_once() is True

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is True
    assert job.attempts == 1
    assert job.claimed_at is None
    assert job.error_message is not None
    assert "the embedder is down" in job.error_message
    assert job.updated_at > datetime.now(UTC)
    assert await worker.run_once() is False, "a backed-off job must not be claimed again yet"
    assert await profile_chunks(db_session, candidate_id) == []


async def test_a_retry_that_works_embeds_the_profile(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    flaky = FakeEmbedder(RuntimeError("a blip"))
    worker = a_reembed_worker(database, flaky)

    await worker.run_once()
    flaky.failure = None
    await worker.run_once()

    assert flaky.call_count == 2
    assert await profile_chunks(db_session, candidate_id) != []
    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is False
    assert job.attempts == 0


async def test_the_sweep_releases_a_job_whose_worker_died(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    worker = a_reembed_worker(database, FakeEmbedder(), stuck_after_seconds=60)
    await _abandon_the_claim(db_session, candidate_id, claimed_ago=timedelta(minutes=5))

    assert await worker.sweep() == 1

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.claimed_at is None
    assert job.error_message is not None
    assert "stopped responding" in job.error_message

    await worker.run_once()
    assert await profile_chunks(db_session, candidate_id) != []


async def test_the_sweep_leaves_work_that_is_still_running_alone(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    worker = a_reembed_worker(database, FakeEmbedder(), stuck_after_seconds=600)
    await _abandon_the_claim(db_session, candidate_id, claimed_ago=timedelta(seconds=30))

    assert await worker.sweep() == 0
    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.claimed_at is not None


async def test_an_empty_queue_is_no_work(database: Database) -> None:
    assert await a_reembed_worker(database, FakeEmbedder()).run_once() is False


async def _abandon_the_claim(
    session: AsyncSession, candidate_id: UUID, *, claimed_ago: timedelta
) -> None:
    await session.execute(
        update(CandidateEmbeddingJob)
        .where(CandidateEmbeddingJob.candidate_id == candidate_id)
        .values(claimed_at=datetime.now(UTC) - claimed_ago, attempts=1)
    )
    await session.commit()


async def _claimed_by_somebody_else(session: AsyncSession, candidate_id: UUID) -> None:
    """What a sweep and a second claim leave behind: a fresh claim, one attempt further on."""
    await session.execute(
        update(CandidateEmbeddingJob)
        .where(CandidateEmbeddingJob.candidate_id == candidate_id)
        .values(claimed_at=datetime.now(UTC), attempts=2, error_message=None)
    )
    await session.commit()


async def test_only_the_chunks_whose_text_changed_reach_the_embedder(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    """A profile is rebuilt whole on every change, but a chunk's text is what its vector means —
    so adding one skill should cost one embedding, not a whole profile's worth."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    embedder = FakeEmbedder()
    worker = a_reembed_worker(database, embedder)
    await worker.run_once()
    first = await profile_chunks(db_session, candidate_id)
    assert len(embedder.calls) == 1

    await browser.put(
        PROFILE,
        json={**A_FULL_PROFILE, "skills": [{"name": "Python", "years_experience": 9.0}]},
    )
    await worker.run_once()

    assert embedder.calls[1] == ["Skills\nPython (9 years)"]
    unchanged = {chunk.chunk_text: list(chunk.embedding) for chunk in first}
    rebuilt = await profile_chunks(db_session, candidate_id)
    reused = [chunk for chunk in rebuilt if chunk.chunk_text in unchanged]
    assert len(reused) == len(rebuilt) - 1
    assert all(list(chunk.embedding) == unchanged[chunk.chunk_text] for chunk in reused)


async def test_a_profile_that_did_not_change_costs_no_embedding_at_all(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)
    embedder = FakeEmbedder()
    worker = a_reembed_worker(database, embedder)
    await worker.run_once()

    await browser.put(PROFILE, json=A_FULL_PROFILE)
    await worker.run_once()

    assert len(embedder.calls) == 1
    assert await profile_chunks(db_session, candidate_id) != []
