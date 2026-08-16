from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, literal_column

from sync_api.applications.payload import ApplicationSort
from sync_api.pagination import Ordering
from sync_core.models import Application

if TYPE_CHECKING:
    from typing import Any

#: An Application nobody has read yet is not a zero — it is an absence, and -1 is where an
#: absence sorts among percentages that all start at 0. Written as one expression rather than
#: `nulls last` so a single index serves both directions: `(job_id, this desc, id desc)` is read
#: forwards for the best first and backwards for the worst first.
UNREAD: Final = Decimal(-1)

#: Spelled into the SQL rather than bound, because this has to come out character for character
#: the way `applications_job_match_score_idx` declares it. A bound parameter would read the same
#: and plan a sort over every Application the Job has.
_MATCH: Final = func.coalesce(Application.current_match_score, literal_column(str(UNREAD)))


def _applied(application: Any) -> str:
    return application.applied_at.isoformat()


def _match(application: Any) -> str:
    score = application.current_match_score
    return str(UNREAD if score is None else score)


def _percentage(written: str) -> Decimal:
    """A cursor's score, read back. `Decimal` raises out of `ArithmeticError` rather than
    `ValueError` on nonsense, which the caller reads as a bug rather than a bad cursor."""
    try:
        return Decimal(written)
    except InvalidOperation as unusable:
        raise ValueError(f"{written!r} is not a percentage") from unusable


ORDERINGS: Final[dict[ApplicationSort, Ordering]] = {
    ApplicationSort.NEWEST: Ordering(
        "newest", Application.applied_at, True, datetime.fromisoformat, _applied
    ),
    ApplicationSort.OLDEST: Ordering(
        "oldest", Application.applied_at, False, datetime.fromisoformat, _applied
    ),
    ApplicationSort.HIGHEST_MATCH: Ordering("highest_match", _MATCH, True, _percentage, _match),
    ApplicationSort.LOWEST_MATCH: Ordering("lowest_match", _MATCH, False, _percentage, _match),
}
