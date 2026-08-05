from __future__ import annotations

from datetime import UTC, date, datetime

from sync_core.experience import (
    WorkPeriod,
    business_today,
    months_worked,
    total_experience_years,
)

TODAY = date(2026, 7, 27)


def a_job(start: tuple[int, int] | None, end: tuple[int, int] | None) -> WorkPeriod:
    return WorkPeriod(
        start_year=None if start is None else start[0],
        start_month=None if start is None else start[1],
        end_year=None if end is None else end[0],
        end_month=None if end is None else end[1],
        is_current=start is not None and end is None,
    )


def test_no_work_at_all_is_no_months() -> None:
    assert months_worked((), TODAY) == (0, False)


def test_a_job_is_counted_from_its_first_month_to_its_last() -> None:
    months, _undated = months_worked((a_job((2024, 1), (2025, 12)),), TODAY)

    assert months == 24


def test_a_single_month_is_one_month() -> None:
    months, _undated = months_worked((a_job((2024, 3), (2024, 3)),), TODAY)

    assert months == 1


def test_two_jobs_held_at_once_are_counted_once() -> None:
    both = (a_job((2022, 1), (2023, 12)), a_job((2022, 6), (2023, 12)))

    months, _undated = months_worked(both, TODAY)

    assert months == 24


def test_jobs_that_do_not_overlap_are_added_up() -> None:
    apart = (a_job((2020, 1), (2020, 6)), a_job((2024, 1), (2024, 6)))

    months, _undated = months_worked(apart, TODAY)

    assert months == 12


def test_a_job_starting_the_month_after_another_ends_is_one_unbroken_stretch() -> None:
    back_to_back = (a_job((2024, 1), (2024, 6)), a_job((2024, 7), (2024, 12)))

    months, _undated = months_worked(back_to_back, TODAY)

    assert months == 12


def test_a_current_job_counts_up_to_the_day_it_is_measured() -> None:
    months, _undated = months_worked((a_job((2026, 1), None),), TODAY)

    assert months == 7


def test_a_month_the_entry_does_not_give_runs_to_the_edge_of_its_year() -> None:
    months, _undated = months_worked((WorkPeriod(2024, None, 2024, None, is_current=False),), TODAY)

    assert months == 12


def test_a_job_with_no_start_year_cannot_be_measured() -> None:
    months, undated = months_worked((a_job(None, None),), TODAY)

    assert (months, undated) == (0, True)


def test_a_finished_job_with_no_end_year_cannot_be_measured() -> None:
    unfinished = WorkPeriod(2020, 1, None, None, is_current=False)

    months, undated = months_worked((unfinished,), TODAY)

    assert (months, undated) == (0, True)


def test_an_undated_job_does_not_stop_the_dated_ones_counting() -> None:
    mixed = (a_job((2024, 1), (2024, 12)), a_job(None, None))

    months, undated = months_worked(mixed, TODAY)

    assert (months, undated) == (12, True)


def test_a_finished_job_is_measured_in_whole_years() -> None:
    assert total_experience_years((a_job((2018, 1), (2020, 12)),), TODAY) == 3


def test_five_months_round_down_and_six_round_up() -> None:
    five = total_experience_years((a_job((2020, 1), (2020, 5)),), TODAY)
    six = total_experience_years((a_job((2020, 1), (2020, 6)),), TODAY)

    assert (five, six) == (0, 1)


def test_thirty_one_months_clear_a_three_year_bar() -> None:
    """The rounding loosens Screening on purpose, and this is the case it was decided on."""
    assert total_experience_years((a_job((2020, 1), (2022, 7)),), TODAY) == 3


def test_the_day_work_is_measured_against_is_the_one_in_the_business_timezone() -> None:
    """Three hours ahead of UTC, so the last hours of a month here are already the next one
    there — and a month is enough to cross a rounding threshold."""
    last_hours_of_june = datetime(2026, 6, 30, 22, 0, tzinfo=UTC)

    assert business_today(last_hours_of_june) == date(2026, 7, 1)


def test_deriving_in_utc_at_a_month_boundary_would_lose_a_year() -> None:
    still_held = (a_job((2025, 2), None),)
    last_hours_of_june = datetime(2026, 6, 30, 22, 0, tzinfo=UTC)

    in_business_hours = total_experience_years(still_held, business_today(last_hours_of_june))

    assert total_experience_years(still_held, last_hours_of_june.date()) == 1
    assert in_business_hours == 2
