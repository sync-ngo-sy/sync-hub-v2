"""What the database refuses on its own, whoever is asking.

The backend holds the service role, so RLS does not apply to it — these are the rows it must
not be able to rewrite even by mistake, and only a trigger can say so. Written as raw SQL
against the tables rather than through the API, because there is no API for doing this: the
point is that the floor holds when somebody goes around the front door.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from tests.support.applications import (
    a_candidate_who_can_apply,
    an_accepted_application,
)
from tests.support.jobs import a_published_job

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

WRITTEN_ONCE = (
    "application_profile_snapshots",
    "application_experiences",
    "application_educations",
    "application_skills",
    "application_languages",
    "application_projects",
    "application_answers",
    "application_qualification_history",
    "application_status_history",
)


async def an_application(
    recruiter: AsyncClient, browser: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, Any]:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(browser, mailbox, session)
    return await an_accepted_application(browser, job["id"])


async def test_a_snapshot_row_cannot_be_updated(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The one that matters most: a Total experience nobody can raise after the fact."""
    application = await an_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(DBAPIError, match="written once"):
        await db_session.execute(
            text(
                "update application_profile_snapshots set total_experience_years = 40 "
                "where application_id = :id"
            ),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_a_snapshot_row_cannot_be_deleted(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await an_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(DBAPIError, match="written once"):
        await db_session.execute(
            text("delete from application_profile_snapshots where application_id = :id"),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_the_frozen_work_history_a_verdict_cites_cannot_be_edited(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await an_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(DBAPIError, match="written once"):
        await db_session.execute(
            text("update application_experiences set start_year = 1990 where application_id = :id"),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_the_record_of_what_was_decided_cannot_be_rewritten(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await an_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(DBAPIError, match="written once"):
        await db_session.execute(
            text(
                "update application_qualification_history set qualification_status = 'qualified' "
                "where application_id = :id"
            ),
            {"id": application["id"]},
        )
    await db_session.rollback()


@pytest.mark.parametrize("table", WRITTEN_ONCE)
async def test_every_frozen_table_refuses_both_ways(db_session: AsyncSession, table: str) -> None:
    """Named one by one, so a table added to the Snapshot later cannot quietly go unguarded."""
    triggers = await db_session.scalars(
        text(
            "select trigger_name from information_schema.triggers "
            "where event_object_table = :table and trigger_name = 'written_once' "
            "and event_manipulation in ('UPDATE', 'DELETE')"
        ),
        {"table": table},
    )

    assert len(list(triggers)) == 2


async def test_an_application_can_still_be_made(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Inserts are untouched — a Snapshot is written once, and each hop of the pipeline appends."""
    application = await an_application(recruiter, other_browser, mailbox, db_session)

    assert application["id"]
