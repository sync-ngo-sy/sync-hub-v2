"""How long somebody has worked, from the jobs they list. One implementation, one answer.

Screening measured this from an Application's Snapshot and a Candidate's profile derives it on
every save; both readings have to agree forever, so the rule lives here rather than in either.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from datetime import date

MONTHS_A_YEAR: Final = 12

#: Where the platform's people are. Deriving in UTC would credit somebody a month less through
#: the last three hours of every month here, which is enough to cross a rounding threshold and
#: change the number a Recruiter filters on. Syria has kept a single offset since 2022.
BUSINESS_TIMEZONE: Final = ZoneInfo("Asia/Damascus")


def business_today(now: datetime | None = None) -> date:
    """Today where the platform's people are, which is the day their work is measured against."""
    return (now or datetime.now(UTC)).astimezone(BUSINESS_TIMEZONE).date()


def total_experience_years(periods: Iterable[WorkPeriod], today: date) -> int:
    """Whole years of work: jobs held at once counted once, six months or more rounding up.

    Whole years because that is the question a Recruiter asks — three years of work, not 38
    months — and because a stored number nobody can edit should not pretend to a precision the
    dates behind it do not have. The rounding loosens Screening on purpose: 31 months now
    clears a three-year bar.
    """
    months, _undated = months_worked(periods, today)
    return (months + MONTHS_A_YEAR // 2) // MONTHS_A_YEAR


@dataclass(frozen=True, slots=True)
class WorkPeriod:
    """One job as a profile or a Snapshot dates it, and nothing else about it."""

    start_year: int | None
    start_month: int | None
    end_year: int | None
    end_month: int | None
    is_current: bool


def months_worked(periods: Iterable[WorkPeriod], today: date) -> tuple[int, bool]:
    """Months of work and whether anything was left out for want of dates.

    Overlapping jobs are merged rather than added up: two at once is one year a year, not two.
    """
    dated, undated = [], False
    for period in periods:
        months = _months_of(period, today)
        if months is None:
            undated = True
        else:
            dated.append(months)
    return sum(end - start + 1 for start, end in _merged(dated)), undated


def _months_of(period: WorkPeriod, today: date) -> tuple[int, int] | None:
    """A job as the inclusive months it ran for, or nothing if the dates cannot say.

    A missing month runs to the edge of its year — the reading `aexp_ordered` already takes,
    where `coalesce(start_month,1)` and `coalesce(end_month,12)` decide whether a year-only
    period is even valid. A year is the unit a year-only entry was given in.
    """
    if period.start_year is None:
        return None
    start = _month_index(period.start_year, period.start_month or 1)
    if period.is_current:
        end = _month_index(today.year, today.month)
    elif period.end_year is None:
        return None
    else:
        end = _month_index(period.end_year, period.end_month or 12)
    return None if end < start else (start, end)


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
