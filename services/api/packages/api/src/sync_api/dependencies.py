"""What a route asks for and the app supplies."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Database

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


def get_database(request: Request) -> Database:
    return cast("Database", request.app.state.database)


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    """A session for the duration of one request. Routes commit their own work."""
    async with database.session() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
