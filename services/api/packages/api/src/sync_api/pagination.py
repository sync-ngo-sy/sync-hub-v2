"""Where a list left off, as one opaque string.

Keyset rather than offset, for every unbounded list in the API. `LIMIT 20 OFFSET 400` asks
Postgres to walk and throw away four hundred rows, and — the part that actually bites — a
row inserted while somebody is paging shifts every later page by one, so an offset-paged
list quietly shows a row twice or skips one. A keyset cursor names the row the last page
ended on, so the next page starts *after that row* whatever has happened since.

The cursor is `(created_at, id)` because that is what these lists are ordered by: newest
first, with the id breaking ties so two rows written in the same transaction — sharing
`created_at` to the microsecond — cannot straddle a page boundary and be lost between two
pages.

It is base64 and undocumented on purpose. A client that decoded one and started composing
its own would be depending on the ordering of a query it cannot see; the contract is that a
cursor comes from a previous page and goes back unread.
"""

from __future__ import annotations

import binascii
from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime
from typing import Final
from uuid import UUID

from sync_api.problems import INVALID_CURSOR_PROBLEM_TYPE, Problem

#: How many items a page carries when the caller does not say.
DEFAULT_PAGE_SIZE: Final = 20

#: The most one page will ever carry, however large a `limit` is asked for.
MAX_PAGE_SIZE: Final = 100

#: Separates the two halves inside an encoded cursor. Not a character an ISO timestamp or a
#: UUID contains, so the split can never land in the middle of either.
_SEPARATOR: Final = "|"


@dataclass(frozen=True, slots=True)
class Cursor:
    """The last row of a page, as the next page's starting point."""

    created_at: datetime
    id: UUID

    def encode(self) -> str:
        """The cursor as it travels: base64url, unpadded, safe in a query string."""
        raw = f"{self.created_at.isoformat()}{_SEPARATOR}{self.id}".encode()
        return urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, encoded: str) -> Cursor:
        """Read back a cursor this API issued, or refuse the request.

        Anything unreadable is the caller's mistake — a hand-written cursor, a truncated
        one, one from a list ordered differently — and a 422 naming the parameter is a far
        more useful answer than the arbitrary page a lenient parse would produce.
        """
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
