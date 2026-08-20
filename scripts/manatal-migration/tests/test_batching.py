"""Trying the migration on a hundred people before trusting it with five thousand.

The cap is on the *outstanding* rather than on what is read from Manatal, and that distinction is
the whole point: `MANATAL_LIMIT` reads the first N records, so a second run with the same limit
re-reads the same N — all of them settled by then — and brings nobody new across. These tests pin
the difference.
"""

from __future__ import annotations

import pytest

from migrate import this_batch


def test_a_batch_takes_that_many_and_leaves_the_rest() -> None:
    assert this_batch(list(range(10)), 3) == [0, 1, 2]


@pytest.mark.parametrize("batch", [0, -1])
def test_no_batch_means_everybody(batch: int) -> None:
    assert this_batch(list(range(10)), batch) == list(range(10))


def test_a_batch_larger_than_what_is_left_takes_what_is_left() -> None:
    assert this_batch([1, 2], 100) == [1, 2]


def test_an_empty_account_is_an_empty_batch() -> None:
    assert this_batch([], 100) == []


def test_consecutive_runs_march_through_rather_than_repeating() -> None:
    """What a second run sees is what the first left outstanding, so the batch moves forward."""
    everybody = list(range(10))
    settled: set[int] = set()

    for _ in range(4):
        outstanding = [who for who in everybody if who not in settled]
        settled.update(this_batch(outstanding, 3))

    assert settled == set(everybody)


def test_the_batch_is_taken_in_the_order_manatal_gave_them() -> None:
    """Stable order is what makes "the next hundred" mean anything across runs."""
    assert this_batch(["c", "a", "b"], 2) == ["c", "a"]
