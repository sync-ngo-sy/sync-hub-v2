from __future__ import annotations

import pytest

from phones import E164, ISO_COUNTRY, Phone, as_phone

SYRIAN: str = "+963932345678"


@pytest.mark.parametrize(
    "written",
    [
        "+963932345678",
        "0932345678",
        "+963 932 345 678",
        "(+963) 932-345-678",
        "00963932345678",
        "00 963 932 345 678",
        " 0932 345 678 ",
    ],
)
def test_a_syrian_number_however_it_was_written(written: str) -> None:
    assert as_phone(written) == Phone(SYRIAN, "SY")


def test_an_international_number_keeps_its_own_country() -> None:
    """The configured region is for numbers that state none, not an override of the ones that do."""
    assert as_phone("+971501234567", region="SY") == Phone("+971501234567", "AE")


def test_a_number_dialled_out_is_read_as_international_not_local() -> None:
    """00 is how a number leaves its country. Read as local it would land under the wrong flag."""
    assert as_phone("00971501234567", region="SY") == Phone("+971501234567", "AE")


@pytest.mark.parametrize("written", [None, "", "   ", "-", "n/a", "07", "123", "not a number"])
def test_nothing_usable_is_no_phone_rather_than_a_wrong_one(written: str | None) -> None:
    assert as_phone(written) is None


def test_a_number_outside_the_countrys_ranges_is_refused() -> None:
    """Syrian mobiles are 09 3xx; 09 1xx is the right shape and not a number."""
    assert as_phone("0912345678") is None


def test_a_local_number_needs_the_region_to_be_right() -> None:
    """The same digits are a valid number in one country and nothing in another."""
    assert as_phone("0932345678", region="SY") == Phone(SYRIAN, "SY")
    assert as_phone("0932345678", region="GB") is None


def test_what_is_returned_always_satisfies_the_platforms_checks() -> None:
    for written in ("+963932345678", "0932345678", "00963932345678", "+14155552671"):
        found = as_phone(written)
        assert found is not None
        assert E164.match(found.number)
        assert ISO_COUNTRY.match(found.country)
