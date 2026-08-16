from __future__ import annotations

from sync_api.rates import percentage


def test_a_part_of_a_whole_is_a_whole_percentage() -> None:
    assert percentage(12, of=300) == 4


def test_a_part_that_is_all_of_the_whole_is_a_hundred() -> None:
    assert percentage(7, of=7) == 100


def test_nothing_of_something_is_nought_rather_than_nothing() -> None:
    assert percentage(0, of=200) == 0


def test_a_rate_over_nothing_says_nothing() -> None:
    """The one case a number would lie about: no views is not a channel converting at 0%."""
    assert percentage(0, of=0) is None
