"""How long somebody has worked, derived the way the platform derives it.

Mirrored from `sync_core.experience` rather than imported, on the same terms as `completeness` and
`links`. It has to be mirrored rather than skipped: `candidates.total_experience_years` is not
maintained by a trigger. The API recomputes it on every profile save, so rows written in raw SQL
leave the column at its default of nought.

Nought is not a harmless default. It is what a Recruiter filters on — `searchable.py` drops
anybody below `minimum_total_experience_years` — so a migration that publishes 5,000 people
cross-tenant and leaves this at nought has published 5,000 people the commonest filter excludes,
and shown every one of them in the pool as having never worked.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator, Sequence
    from datetime import date

MONTHS_A_YEAR: Final = 12

#: Where the platform's people are. Deriving in UTC would credit somebody a month less through
#: the last three hours of every month here, which is enough to cross a rounding threshold.
BUSINESS_TIMEZONE: Final = ZoneInfo("Asia/Damascus")

#: Where `start_year`, `start_month`, `end_year` and `end_month` sit in the tuples this script
#: inserts into `candidate_experiences`. Read off the same row shape `profile_rows` builds, so
#: the number is derived from what is actually written rather than from a second reading of it.
START_YEAR: Final = 4
START_MONTH: Final = 5
END_YEAR: Final = 6
END_MONTH: Final = 7


@dataclass(frozen=True, slots=True)
class WorkPeriod:
    """One job as a profile dates it. No end means still held."""

    start_year: int
    start_month: int | None
    end_year: int | None
    end_month: int | None


def business_today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(BUSINESS_TIMEZONE).date()


def periods_of(rows: Sequence[tuple[object, ...]]) -> list[WorkPeriod]:
    """The `candidate_experiences` tuples as measurable periods.

    A row with no start year cannot be one, and cannot be in the table either — `profile_rows`
    drops those before they get here, so this is a guard rather than a policy.
    """
    periods = []
    for row in rows:
        start_year = row[START_YEAR]
        if not isinstance(start_year, int):
            continue
        periods.append(
            WorkPeriod(
                start_year=start_year,
                start_month=_int(row[START_MONTH]),
                end_year=_int(row[END_YEAR]),
                end_month=_int(row[END_MONTH]),
            )
        )
    return periods


def total_experience_years(periods: Iterable[WorkPeriod], today: date) -> int:
    """Whole years of work: jobs held at once counted once, six months or more rounding up."""
    return (months_worked(periods, today) + MONTHS_A_YEAR // 2) // MONTHS_A_YEAR


def months_worked(periods: Iterable[WorkPeriod], today: date) -> int:
    """Months of work, overlapping jobs merged rather than added up."""
    return sum(end - start + 1 for start, end in _merged(_months_of(periods, today)))


def _months_of(periods: Iterable[WorkPeriod], today: date) -> list[tuple[int, int]]:
    """Each job as the inclusive months it ran for. A missing month runs to the edge of its year."""
    months = []
    for period in periods:
        start = _month_index(period.start_year, period.start_month or 1)
        end = (
            _month_index(today.year, today.month)
            if period.end_year is None
            else _month_index(period.end_year, period.end_month or 12)
        )
        if end >= start:
            months.append((start, end))
    return months


def _merged(periods: list[tuple[int, int]]) -> Iterator[tuple[int, int]]:
    merged: tuple[int, int] | None = None
    for start, end in sorted(periods):
        if merged is None:
            merged = (start, end)
        elif start <= merged[1] + 1:
            merged = (merged[0], max(merged[1], end))
        else:
            yield merged
            merged = (start, end)
    if merged is not None:
        yield merged


def _month_index(year: int, month: int) -> int:
    return year * 12 + month


def _int(value: object) -> int | None:
    return value if isinstance(value, int) else None
