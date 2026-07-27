"""Committing one request's work.

One helper, because the obvious alternative is wrong in a way that only shows up once a
route has an access gate in front of it.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def transaction(session: AsyncSession) -> AsyncIterator[None]:
    """All-or-nothing, on a session that has very likely already read something.

    Not `session.begin()`: by the time an access-gated route runs, the gate has issued its
    SELECT and SQLAlchemy has autobegun a transaction on this session — and `begin()`
    refuses to nest on one. Committing at the end covers the same statements, and those
    reads coming along for the ride costs nothing.
    """
    try:
        yield
        await session.commit()
    except BaseException:
        await session.rollback()
        raise
