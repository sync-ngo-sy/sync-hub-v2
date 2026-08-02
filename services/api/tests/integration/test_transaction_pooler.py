"""The engine against a real transaction-mode pooler.

Transaction pooling hands each transaction whichever server connection happens to be free,
so two clients routinely land on the same one. With asyncpg's prepared-statement caching
left on, both ask the server to prepare `__asyncpg_stmt_1__` and the second gets
DuplicatePreparedStatementError -- intermittently, and only under concurrency, which is why
it is worth exercising here rather than trusting the configuration.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import pytest
from sqlalchemy import text

from sync_core import Database
from tests.support import stack

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sync_core import Settings

CONCURRENT_SESSIONS = 24
QUERIES_PER_SESSION = 6


def _pooler_enabled_in_config() -> bool:
    config = (stack.SUPABASE_DIR / "config.toml").read_text()
    section = config.partition("[db.pooler]")[2].partition("\n[")[0]
    return "enabled = true" in section


def _pooler_url() -> str:
    for key, value in stack.stack_config().items():
        if "POOLER" in key.upper() and value:
            return str(value).replace("postgresql://", "postgresql+asyncpg://", 1)

    # Skipping when the pooler is switched off is fine. Skipping when it is switched on
    # would mean this file quietly stops testing anything, which is the failure mode worth
    # guarding: the whole point is that the deployed path is exercised somewhere.
    if _pooler_enabled_in_config():
        message = (
            "[db.pooler] is enabled in supabase/config.toml but `supabase status` reports no "
            "pooler URL. The stack is out of date, or the CLI renamed the key and this test "
            "needs updating -- it must not silently skip."
        )
        raise AssertionError(message)

    pytest.skip("the local pooler is disabled; set [db.pooler] enabled = true to run this")


@pytest.fixture(scope="session")
async def pooled_database(settings: Settings, _migrated_database: None) -> AsyncIterator[Database]:
    pooled = settings.model_copy(update={"database_url": _pooler_url()})
    db = Database(pooled)
    yield db
    await db.dispose()


async def test_concurrent_sessions_share_server_connections(pooled_database: Database) -> None:
    async def query(marker: int) -> list[int]:
        seen = []
        for attempt in range(QUERIES_PER_SESSION):
            async with pooled_database.session() as session:
                result = await session.execute(
                    text("select :marker + :attempt"),
                    {"marker": marker, "attempt": attempt},
                )
                seen.append(result.scalar_one())
        return seen

    results = await asyncio.gather(*(query(marker) for marker in range(CONCURRENT_SESSIONS)))

    assert results == [
        [marker + attempt for attempt in range(QUERIES_PER_SESSION)]
        for marker in range(CONCURRENT_SESSIONS)
    ]


async def test_the_schema_is_reachable_through_the_pooler(pooled_database: Database) -> None:
    async with pooled_database.session() as session:
        result = await session.execute(text("select count(*) from languages"))

    assert result.scalar_one() > 0
