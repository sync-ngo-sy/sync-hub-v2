from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

if TYPE_CHECKING:
    import asyncpg
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Storage

STORED_NAMES = text("select name from storage.objects where bucket_id = :bucket order by name")


async def stored_paths(session: AsyncSession, bucket: str) -> list[str]:
    stored = await session.execute(STORED_NAMES, {"bucket": bucket})
    return [row[0] for row in stored]


async def empty_bucket(connection: asyncpg.Connection, storage: Storage, bucket: str) -> None:
    stored = await connection.fetch("select name from storage.objects where bucket_id = $1", bucket)
    for row in stored:
        await storage.remove(row["name"])
