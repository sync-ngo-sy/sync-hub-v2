from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Final
from uuid import UUID

from experience import (
    MONTHS_A_YEAR,
    WorkPeriod,
    months_worked,
    periods_of,
    total_experience_years,
)

TODAY: Final = date(2026, 8, 20)
SOMEBODY: Final = UUID(int=1)

PLATFORM: Final = (
    Path(__file__).resolve().parents[3]
    / "services"
    / "api"
    / "packages"
    / "core"
    / "src"
    / "sync_core"
    / "experience.py"
)


def a_job(start_year: int, start_month=None, end_year=None, end_month=None) -> WorkPeriod:
    return WorkPeriod(start_year, start_month, end_year, end_month)


def test_a_finished_year_long_job_is_a_year() -> None:
    assert total_experience_years([a_job(2020, 1, 2020, 12)], TODAY) == 1


def test_a_job_still_held_is_measured_to_today() -> None:
    assert total_experience_years([a_job(2024, 8)], TODAY) == 2


def test_two_jobs_at_once_are_counted_once() -> None:
    """Two years of overlapping work is one year a year, not two."""
    both = [a_job(2020, 1, 2021, 12), a_job(2020, 6, 2021, 6)]

    assert total_experience_years(both, TODAY) == 2


def test_touching_jobs_join_up() -> None:
    ends_then_starts = [a_job(2020, 1, 2020, 6), a_job(2020, 7, 2020, 12)]

    assert months_worked(ends_then_starts, TODAY) == MONTHS_A_YEAR


def test_a_gap_between_jobs_is_not_worked() -> None:
    apart = [a_job(2018, 1, 2018, 12), a_job(2020, 1, 2020, 12)]

    assert total_experience_years(apart, TODAY) == 2


def test_six_months_rounds_up_and_five_rounds_down() -> None:
    assert total_experience_years([a_job(2026, 3, 2026, 8)], TODAY) == 1
    assert total_experience_years([a_job(2026, 4, 2026, 8)], TODAY) == 0


def test_a_year_only_entry_runs_the_whole_year() -> None:
    """A missing month runs to the edge of its year, which is the reading `cexp_ordered` takes."""
    assert months_worked([a_job(2020, None, 2020, None)], TODAY) == MONTHS_A_YEAR


def test_no_jobs_is_no_experience() -> None:
    assert total_experience_years([], TODAY) == 0


def test_the_rows_the_script_writes_are_read_as_periods() -> None:
    """Read off the tuple `profile_rows` builds, so the number matches what is stored."""
    rows = [
        (SOMEBODY, 0, "Engineer", None, 2019, 3, 2021, 6, False, None),
        (SOMEBODY, 1, "Lead", None, 2021, 7, None, None, True, None),
    ]

    assert periods_of(rows) == [
        WorkPeriod(2019, 3, 2021, 6),
        WorkPeriod(2021, 7, None, None),
    ]


def test_a_row_with_no_start_year_is_not_a_period() -> None:
    """It cannot be in the table either, so this is a guard rather than a policy."""
    assert periods_of([(SOMEBODY, 0, "Undated", None, None, None, None, None, False, None)]) == []


def test_the_derivation_still_matches_the_platforms_own() -> None:
    """The column is not maintained by a trigger, so this mirror is the only thing keeping the
    migrated number and the API's number the same."""
    if not PLATFORM.exists():  # pragma: no cover — running outside the repository
        return
    upstream = PLATFORM.read_text(encoding="utf-8")
    assert 'ZoneInfo("Asia/Damascus")' in upstream
    assert "MONTHS_A_YEAR: Final = 12" in upstream
    rounding = r"months_worked\(periods, today\) \+ MONTHS_A_YEAR // 2\) // MONTHS_A_YEAR"
    assert re.search(rounding, upstream)
