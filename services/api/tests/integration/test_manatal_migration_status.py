from __future__ import annotations

from typing import Final
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import a_searchable_candidate, save_to_pool
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.tenants import a_teammate

PATH: Final = "/v1/tenants/me/manatal-migration"


async def test_a_tenant_admin_reads_manatal_migration_progress(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    await save_to_pool(recruiter, candidate_id)
    await _as_an_unclaimed_import(db_session, candidate_id)

    answered = await recruiter.get(PATH)

    assert answered.status_code == 200, answered.text
    body = answered.json()
    assert body["counts"]["total"] == 1
    assert body["counts"]["published"] == 1
    assert body["counts"]["unclaimed"] == 1
    assert body["recent"][0]["candidate_id"] == str(candidate_id)
    assert body["recent"][0]["is_claimed"] is False


async def test_a_recruiter_who_is_not_an_admin_cannot_read_manatal_migration_progress(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
) -> None:
    await a_teammate(recruiter, other_browser, mailbox)

    refused = await other_browser.get(PATH)

    assert refused.status_code == 403, refused.text


async def _as_an_unclaimed_import(session: AsyncSession, candidate_id: UUID) -> None:
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
