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
    #: The number a ranked order sorted on, carried so the next page resumes at the same place.
    #: Null in the orders that sort by date alone.
    rank: int | None = None
    order: str | None = None

    def encode(self) -> str:
        parts = [self.created_at.isoformat(), str(self.id)]
        if self.rank is not None or self.order is not None:
            parts.append("" if self.rank is None else str(self.rank))
        if self.order is not None:
            parts.append(self.order)
        raw = _SEPARATOR.join(parts).encode()
        return urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, encoded: str) -> Cursor:
        try:
            padded = encoded + "=" * (-len(encoded) % 4)
            timestamp, identifier, *rest = urlsafe_b64decode(padded).decode().split(_SEPARATOR)
            if len(rest) > 2:
                raise ValueError("a cursor has too many parts")
            return cls(
                created_at=datetime.fromisoformat(timestamp),
                id=UUID(identifier),
                rank=int(rest[0]) if rest and rest[0] else None,
                order=rest[1] if len(rest) == 2 else None,
            )
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


def _wrong_order() -> Problem:
    return Problem(
        status=422,
        type=INVALID_CURSOR_PROBLEM_TYPE,
        detail="That cursor was issued for a different order. Ask for the first page of this one.",
    )


def newest_first[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    created_at: SQLColumnExpression[datetime],
    id_: SQLColumnExpression[UUID],
    cursor: str | None,
    limit: int,
    cursor_order: str | None = None,
) -> Select[Selected]:
    """Order and window one page, asking for a row more than fits so `page_of` knows there is."""
    return _windowed(
        query,
        order=(created_at.desc(), id_.desc()),
        keys=(created_at, id_),
        after=_by_date(cursor, cursor_order),
        descending=True,
        limit=limit,
    )


def oldest_first[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    created_at: SQLColumnExpression[datetime],
    id_: SQLColumnExpression[UUID],
    cursor: str | None,
    limit: int,
    cursor_order: str | None = None,
) -> Select[Selected]:
    """The same page from the other end: the oldest row first, and the cursor climbing."""
    return _windowed(
        query,
        order=(created_at.asc(), id_.asc()),
        keys=(created_at, id_),
        after=_by_date(cursor, cursor_order),
        descending=False,
        limit=limit,
    )


def most_first[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    rank: SQLColumnExpression[Any],
    created_at: SQLColumnExpression[datetime],
    id_: SQLColumnExpression[UUID],
    cursor: str | None,
    limit: int,
    cursor_order: str | None = None,
) -> Select[Selected]:
    """Busiest first, and newest first among rows that tie.

    The date and the id stay in the key because a rank repeats: without them a page boundary
    landing inside a run of ties would skip the rest of the run or repeat it.
    """
    return _windowed(
        query,
        order=(rank.desc(), created_at.desc(), id_.desc()),
        keys=(rank, created_at, id_),
        after=_by_rank(cursor, cursor_order),
        descending=True,
        limit=limit,
    )


def _by_date(cursor: str | None, order: str | None) -> tuple[Any, ...] | None:
    """Where a date-ordered page resumes. A cursor carrying a rank came out of a ranked order,
    and following it here would page one list by another's boundary."""
    if cursor is None:
        return None
    after = Cursor.decode(cursor)
    if after.rank is not None or (order is not None and after.order != order):
        raise _wrong_order()
    return (after.created_at, after.id)


def _by_rank(cursor: str | None, order: str | None) -> tuple[Any, ...] | None:
    if cursor is None:
        return None
    after = Cursor.decode(cursor)
    if after.rank is None or (order is not None and after.order != order):
        raise _wrong_order()
    return (after.rank, after.created_at, after.id)


def _windowed[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    order: tuple[SQLColumnExpression[Any], ...],
    keys: tuple[SQLColumnExpression[Any], ...],
    after: tuple[Any, ...] | None,
    descending: bool,
    limit: int,
) -> Select[Selected]:
    """One page, asking for a row more than fits so `page_of` knows there is another."""
    ordered = query.order_by(*order).limit(limit + 1)
    if after is None:
        return ordered
    row = tuple_(*keys)
    mark = tuple_(*(literal(value) for value in after))
    return ordered.where(row < mark if descending else row > mark)


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
