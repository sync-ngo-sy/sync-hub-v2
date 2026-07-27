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

    from sqlalchemy.orm import InstrumentedAttribute

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
            raise Problem(
                status=422,
                type=INVALID_CURSOR_PROBLEM_TYPE,
                detail="That is not a cursor this API issued. Ask for the first page instead.",
            ) from unusable


def newest_first[Selected: tuple[Any, ...]](
    query: Select[Selected],
    *,
    created_at: InstrumentedAttribute[datetime],
    id_: InstrumentedAttribute[UUID],
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


def page_of[Row](
    found: Sequence[Row], *, limit: int, cursor_for: Callable[[Row], Cursor]
) -> tuple[list[Row], str | None]:
    """The page and the cursor after it — null on the last page, which is what ends the paging."""
    rows, more = list(found[:limit]), len(found) > limit
    return rows, cursor_for(rows[-1]).encode() if more else None
