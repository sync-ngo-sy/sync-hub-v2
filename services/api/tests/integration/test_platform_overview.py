from __future__ import annotations

from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.candidates import a_deleted_account, a_signed_in_candidate
from tests.support.jobs import a_published_job, an_application
from tests.support.mailbox import Mailbox
from tests.support.platform_admins import a_signed_in_platform_admin, read_overview
from tests.support.profiles import my_id
from tests.support.tenants import an_admin

EMPTY = {"tenants": 0, "candidates": 0, "jobs": 0, "applications": 0}


async def test_an_empty_platform_counts_nothing(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    overview = await read_overview(browser)

    assert overview.status_code == 200, overview.text
    assert overview.json() == EMPTY


async def test_the_overview_counts_the_whole_platform(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_admin(other_browser, mailbox)
    job = await a_published_job(other_browser)
    await a_signed_in_candidate(third_browser, mailbox)
    await an_application(db_session, job["id"], await my_id(third_browser))
    await a_signed_in_platform_admin(app, browser, db_session)

    overview = await read_overview(browser)

    assert overview.status_code == 200, overview.text
    assert overview.json() == {"tenants": 1, "candidates": 1, "jobs": 1, "applications": 1}


async def test_a_deleted_candidate_stops_being_counted(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The row survives the deletion — every Application a Tenant received still names it."""
    await a_signed_in_candidate(other_browser, mailbox)
    await a_deleted_account(other_browser)
    await a_signed_in_platform_admin(app, browser, db_session)

    overview = await read_overview(browser)

    assert overview.json()["candidates"] == 0
