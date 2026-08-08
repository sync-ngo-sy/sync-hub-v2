from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final

from sync_api.pagination import SortCursor
from sync_core.searchable import DIRECTORY_PROFILES

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy import SQLColumnExpression


class DirectoryOrder(StrEnum):
    """How the directory has been asked to order itself. Each value names the answer it gives
    rather than a column and a direction, so there is no ascending/descending convention to
    learn — and no way to ask for an order the directory cannot page through."""

    NEWEST = "newest"
    OLDEST = "oldest"
    NAME = "name"
    NAME_REVERSED = "name_reversed"
    MOST_EXPERIENCE = "most_experience"
    LEAST_EXPERIENCE = "least_experience"


@dataclass(frozen=True, slots=True)
class Ordering:
    column: SQLColumnExpression[Any]
    descending: bool
    #: The cursor's written-out value, read back into something the column compares against.
    read: Callable[[str], Any]
    #: One row's value for this column, written out for the cursor.
    wrote: Callable[[Any], str]


_ADDED: Final = DIRECTORY_PROFILES.c.created_at

_YEARS: Final = DIRECTORY_PROFILES.c.total_experience_years

#: Never null: the view reads it from `profiles.full_name`, which the database declares not null.
_NAME: Final = DIRECTORY_PROFILES.c.full_name


def _added(row: Any) -> str:
    return row.created_at.isoformat()


def _name(row: Any) -> str:
    return row.full_name


def _years(row: Any) -> str:
    return str(row.total_experience_years)


ORDERINGS: Final[dict[DirectoryOrder, Ordering]] = {
    DirectoryOrder.NEWEST: Ordering(_ADDED, True, datetime.fromisoformat, _added),
    DirectoryOrder.OLDEST: Ordering(_ADDED, False, datetime.fromisoformat, _added),
    DirectoryOrder.NAME: Ordering(_NAME, False, str, _name),
    DirectoryOrder.NAME_REVERSED: Ordering(_NAME, True, str, _name),
    DirectoryOrder.MOST_EXPERIENCE: Ordering(_YEARS, True, int, _years),
    DirectoryOrder.LEAST_EXPERIENCE: Ordering(_YEARS, False, int, _years),
}


def cursor_for(order: DirectoryOrder, row: Any) -> SortCursor:
    return SortCursor(at=ORDERINGS[order].wrote(row), id=row.candidate_id)
