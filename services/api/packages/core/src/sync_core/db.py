from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sqlalchemy.engine import URL

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


def connect_args(statement_timeout_ms: int) -> dict[str, object]:
    """The pooler-safe arguments, plus the ceiling a single statement may run for.

    Set on the connection rather than per transaction, so it costs no round trip and applies to
    the reads that never open one explicitly. `server_settings` reaches Postgres in asyncpg's
    startup message, which the transaction pooler forwards — exercised through the real pooler
    in `tests/integration/test_transaction_pooler.py`, because a startup parameter a pooler
    refuses is a deployment that cannot connect at all rather than one that runs without a
    timeout.

    Zero leaves it unset, which is Postgres' own default: a statement runs until it finishes.
    """
    if statement_timeout_ms <= 0:
        return dict(POOLER_CONNECT_ARGS)
    return {
        **POOLER_CONNECT_ARGS,
        "server_settings": {"statement_timeout": f"{statement_timeout_ms}ms"},
    }


class Database:
    def __init__(self, settings: Settings) -> None:
        self._engine = create_async_engine(
            pooler_safe_url(str(settings.database_url)),
            echo=settings.database_echo,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,
            connect_args=connect_args(settings.database_statement_timeout_ms),
        )
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
