from __future__ import annotations

import pytest

from sync_core.phone import Phone, read

DAMASCUS = Phone(country="SY", number="+963115550134")


@pytest.mark.parametrize(
    "typed", ["011 555 0134", "0115550134", "(011) 555-0134", "+963 11 555 0134", "+963115550134"]
)
def test_a_number_is_stored_the_same_however_it_was_typed(typed: str) -> None:
    assert read(typed, "SY") == DAMASCUS


def test_an_international_number_says_which_country_it_belongs_to() -> None:
    assert read("+963115550134") == DAMASCUS


def test_a_national_number_with_no_country_is_nobody_s_number() -> None:
    assert read("0115550134") is None


def test_a_number_no_country_can_dial_is_refused() -> None:
    assert read("+1 213 373 4253", "CA") is None


def test_a_country_sharing_a_calling_code_keeps_its_own_numbers() -> None:
    assert read("+1 604 559 5000", "CA") == Phone(country="CA", number="+16045595000")


def test_a_number_too_short_for_its_country_is_refused() -> None:
    assert read("+963 11", "SY") is None


@pytest.mark.parametrize("typed", ["", "   ", "call me", "+", "12"])
def test_something_nobody_could_dial_is_refused(typed: str) -> None:
    assert read(typed, "SY") is None


def test_a_country_the_platform_has_no_numbering_for_is_refused() -> None:
    assert read("0115550134", "ZZ") is None
