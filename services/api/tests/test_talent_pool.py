from __future__ import annotations

from httpx import AsyncClient
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
