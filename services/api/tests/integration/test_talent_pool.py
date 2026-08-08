from __future__ import annotations

from uuid import UUID

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import (
    CANDIDATE_NOT_FOUND,
    a_candidate_nobody_has_met,
    a_searchable_candidate,
    an_application_to_this_tenant,
    drop_from_pool,
    pool_of,
    save_to_pool,
    stop_being_searchable,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id


async def test_an_applicant_saved_to_the_pool_is_in_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)

    saved = await save_to_pool(recruiter, candidate_id)

    assert saved.status_code == 200, saved.text
    assert saved.json()["candidate_id"] == str(candidate_id)
    assert [member["candidate_id"] for member in await pool_of(recruiter)] == [str(candidate_id)]


async def test_a_searchable_candidate_who_never_applied_can_still_be_saved(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)

    saved = await save_to_pool(recruiter, candidate_id)

    assert saved.status_code == 200, saved.text
    assert saved.json()["full_name"] == "Amina Haddad"


async def test_a_candidate_this_tenant_has_never_met_cannot_be_saved(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    candidate_id = await a_candidate_nobody_has_met(other_browser, mailbox)

    refused = await save_to_pool(recruiter, candidate_id)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == CANDIDATE_NOT_FOUND
    assert await pool_of(recruiter) == []


async def test_saving_the_same_candidate_twice_leaves_one_pool_entry(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)

    first = await save_to_pool(recruiter, candidate_id)
    again = await save_to_pool(recruiter, candidate_id)

    assert again.status_code == 200, again.text
    assert again.json()["added_at"] == first.json()["added_at"]
    assert len(await pool_of(recruiter)) == 1


async def test_a_candidate_who_stops_being_searchable_can_still_be_dropped(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The pool entry is the Tenant's own record — losing sight of someone must not strand it."""
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    await save_to_pool(recruiter, candidate_id)
    await stop_being_searchable(other_browser)

    dropped = await drop_from_pool(recruiter, candidate_id)

    assert dropped.status_code == 204, dropped.text
    assert await pool_of(recruiter) == []


async def test_a_candidate_dropped_from_the_pool_leaves_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    await save_to_pool(recruiter, candidate_id)

    dropped = await drop_from_pool(recruiter, candidate_id)
    again = await drop_from_pool(recruiter, candidate_id)

    assert dropped.status_code == 204, dropped.text
    assert again.status_code == 204, again.text
    assert await pool_of(recruiter) == []


async def test_the_pool_says_a_candidate_signed_up_and_has_signed_in(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The ordinary case, so the flags a migrated Candidate carries have something to differ
    from."""
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await save_to_pool(recruiter, candidate_id)

    [member] = await pool_of(recruiter)

    assert member["is_imported_from_manatal"] is False
    assert member["is_claimed"] is True


async def test_the_pool_marks_a_migrated_candidate_nobody_has_claimed(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """What `scripts/manatal-migration` leaves behind: a Candidate the platform made on somebody's
    behalf, whose account nobody has taken over. Both facts have to reach the Recruiter reading
    them, because neither is visible in anything else on the record."""
    await a_searchable_candidate(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await save_to_pool(recruiter, candidate_id)
    await _as_an_unclaimed_import(db_session, candidate_id)

    [member] = await pool_of(recruiter)

    assert member["is_imported_from_manatal"] is True
    assert member["is_claimed"] is False


async def _as_an_unclaimed_import(session: AsyncSession, candidate_id: UUID) -> None:
    """The state the migration script leaves: flagged as Manatal's, and never signed into."""
    await session.execute(
        text("update candidates set is_imported_from_manatal = true where id = :id").bindparams(
            id=candidate_id
        )
    )
    await session.execute(
        text("update auth.users set last_sign_in_at = null where id = :id").bindparams(
            id=candidate_id
        )
    )
    await session.commit()
