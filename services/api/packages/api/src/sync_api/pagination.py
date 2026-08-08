from __future__ import annotations

import binascii
from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import Select, literal, tuple_

from sync_api.problems import INVALID_CURSOR_PROBLEM_TYPE, Problem

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from sqlalchemy import SQLColumnExpression

DEFAULT_PAGE_SIZE: Final = 20

MAX_PAGE_SIZE: Final = 100

#: Absent from any ISO timestamp or UUID, so the split cannot land inside either half.
_SEPARATOR: Final = "|"


@dataclass(frozen=True, slots=True)
class Cursor:
    created_at: datetime
    id: UUID

    def encode(self) -> str:
        raw = f"{self.created_at.isoformat()}{_SEPARATOR}{self.id}".encode()
        return urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, encoded: str) -> Cursor:
        try:
            padded = encoded + "=" * (-len(encoded) % 4)
            timestamp, separator, identifier = (
                urlsafe_b64decode(padded).decode().partition(_SEPARATOR)
            )
            if not separator:
                raise ValueError("a cursor is a timestamp and an id")
            return cls(created_at=datetime.fromisoformat(timestamp), id=UUID(identifier))
        except (ValueError, UnicodeDecodeError, binascii.Error) as unusable:
            raise _not_a_cursor() from unusable


@dataclass(frozen=True, slots=True)
class SortCursor:
    """Where a sorted page left off: the value it was ordered by, written out, and the id that
    broke the tie. Split from the right, because the id can hold no separator and a full name can.
    """

    at: str
    id: UUID

    def encode(self) -> str:
        raw = f"{self.at}{_SEPARATOR}{self.id}".encode()
        return urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, encoded: str) -> SortCursor:
        try:
            padded = encoded + "=" * (-len(encoded) % 4)
            value, separator, identifier = urlsafe_b64decode(padded).decode().rpartition(_SEPARATOR)
            if not separator:
                raise ValueError("a cursor is a sort value and an id")
            return cls(at=value, id=UUID(identifier))
        except (ValueError, UnicodeDecodeError, binascii.Error) as unusable:
            raise _not_a_cursor() from unusable


def _not_a_cursor() -> Problem:
    return Problem(
        status=422,
        type=INVALID_CURSOR_PROBLEM_TYPE,
        detail="That is not a cursor this API issued. Ask for the first page instead.",
    )


def newest_first[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    created_at: SQLColumnExpression[datetime],
    id_: SQLColumnExpression[UUID],
    cursor: str | None,
    limit: int,
) -> Select[Selected]:
    """Order and window one page, asking for a row more than fits so `page_of` knows there is."""
    ordered = query.order_by(created_at.desc(), id_.desc()).limit(limit + 1)
    if cursor is None:
        return ordered
    after = Cursor.decode(cursor)
    return ordered.where(
        tuple_(created_at, id_) < tuple_(literal(after.created_at), literal(after.id))
    )


def ordered_by[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    key: SQLColumnExpression[Any],
    id_: SQLColumnExpression[UUID],
    descending: bool,
    read: Callable[[str], Any],
    cursor: str | None,
    limit: int,
) -> Select[Selected]:
    """Order and window one page by any single column, asking for a row more than fits.

    The id is always the tiebreaker, so the pair it orders on is unique — without it two people
    with the same name, or the same number of years, could swallow or repeat each other across a
    page boundary. `read` turns the cursor's written-out value back into something the column can
    be compared against, and a value that will not read is not a cursor this API issued.
    """
    ordered = (
        query.order_by(key.desc(), id_.desc())
        if descending
        else query.order_by(key.asc(), id_.asc())
    ).limit(limit + 1)
    if cursor is None:
        return ordered
    after = SortCursor.decode(cursor)
    reached = tuple_(key, id_)
    left_off = tuple_(literal(_read(read, after.at)), literal(after.id))
    return ordered.where(reached < left_off if descending else reached > left_off)


def _read(read: Callable[[str], Any], at: str) -> Any:
    try:
        return read(at)
    except (ValueError, TypeError) as unusable:
        raise _not_a_cursor() from unusable


def page_of[Row](
    found: Sequence[Row], *, limit: int, cursor_for: Callable[[Row], Cursor | SortCursor]
) -> tuple[list[Row], str | None]:
    """The page and the cursor after it — null on the last page, which is what ends the paging."""
    rows, more = list(found[:limit]), len(found) > limit
    return rows, cursor_for(rows[-1]).encode() if more else None
