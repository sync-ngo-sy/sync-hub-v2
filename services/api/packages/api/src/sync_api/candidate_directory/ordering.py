from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Final

from sync_api.pagination import Ordering
from sync_core.searchable import DIRECTORY_PROFILES


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
    DirectoryOrder.NEWEST: Ordering("newest", _ADDED, True, datetime.fromisoformat, _added),
    DirectoryOrder.OLDEST: Ordering("oldest", _ADDED, False, datetime.fromisoformat, _added),
    DirectoryOrder.NAME: Ordering("name", _NAME, False, str, _name),
    DirectoryOrder.NAME_REVERSED: Ordering("name_reversed", _NAME, True, str, _name),
    DirectoryOrder.MOST_EXPERIENCE: Ordering("most_experience", _YEARS, True, int, _years),
    DirectoryOrder.LEAST_EXPERIENCE: Ordering("least_experience", _YEARS, False, int, _years),
}
