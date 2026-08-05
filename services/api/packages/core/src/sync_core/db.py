from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sqlalchemy.engine import URL, Connection
    from sqlalchemy.ext.asyncio import AsyncEngine

    from sync_core.settings import Settings


def pooler_safe_url(database_url: str) -> URL:
    """Disable the dialect's prepared-statement cache.

    Transaction-mode pooling gives each transaction whichever server connection is free, so
    a statement prepared on one is missing from the next. The dialect accepts this only as a
    URL query parameter -- passing it to create_async_engine raises "Invalid argument(s)".
    """
    return make_url(database_url).update_query_dict(
        {"prepared_statement_cache_size": "0"}, append=False
    )


#: asyncpg prepares every statement even with its own cache off, and two clients sharing one
#: server connection would otherwise both ask for `__asyncpg_stmt_1__`.
POOLER_CONNECT_ARGS = {
    "statement_cache_size": 0,
    "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
}


def bound_every_statement(engine: AsyncEngine, statement_timeout_ms: int) -> None:
    if statement_timeout_ms <= 0:
        return

    bound = f"set local statement_timeout = '{int(statement_timeout_ms)}ms'"

    @event.listens_for(engine.sync_engine, "begin")
    def _bound_statements(connection: Connection) -> None:
        connection.exec_driver_sql(bound)


class Database:
    def __init__(self, settings: Settings) -> None:
        self._engine = create_async_engine(
            pooler_safe_url(str(settings.database_url)),
            echo=settings.database_echo,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,
            connect_args=POOLER_CONNECT_ARGS,
        )
        bound_every_statement(self._engine, settings.database_statement_timeout_ms)
        self._session_factory = async_sessionmaker(
            self._engine,
            expire_on_commit=False,
            autoflush=False,
        )

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession]:
        async with self._session_factory() as session:
            yield session

    async def dispose(self) -> None:
        await self._engine.dispose()
