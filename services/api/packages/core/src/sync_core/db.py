"""The database connection every process shares.

ADR-0004: one async SQLAlchemy engine over asyncpg, connecting straight to Postgres with
the service role. The backend is the only data client, so this is the whole data path —
there is no PostgREST fallback.

Callers get sessions, never the engine's connections, and a session is always scoped to a
`with` block so it is returned to the pool even when the caller raises.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sync_core.settings import Settings


class Database:
    """Owns the engine for a process and hands out sessions from it."""

    def __init__(self, settings: Settings) -> None:
        self._engine = create_async_engine(
            str(settings.database_url),
            echo=settings.database_echo,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,
        )
        self._session_factory = async_sessionmaker(
            self._engine,
            expire_on_commit=False,
            autoflush=False,
        )

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """A session that is closed on exit. Committing is the caller's decision.

        The multi-row all-or-nothing writes ADR-0001 puts on the backend use
        `async with session.begin()` inside this block; they arrive with the tickets that
        need them.
        """
        async with self._session_factory() as session:
            yield session

    async def dispose(self) -> None:
        """Close every pooled connection. Call once, as the process shuts down."""
        await self._engine.dispose()
