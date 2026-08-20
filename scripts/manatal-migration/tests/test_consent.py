"""Whether a Manatal record says this person agreed to be found.

`is_searchable` is the platform's own words for "opt in to cross-tenant Global search". Reading
this wrong in the permissive direction shows somebody to companies they never applied to, so the
reading is strict and every ambiguous form is tested for falling the safe way.
"""

from __future__ import annotations

import pytest

from manatal import _candidate


def reading(**record: object) -> bool:
    return _candidate({"id": 1, "full_name": "Amal", "email": "a@b.c", **record}).consent


@pytest.mark.parametrize(
    "stated", [True, "true", "True", "yes", "Yes", "y", "1", "granted", "given", "agreed"]
)
def test_a_plain_yes_is_consent(stated: object) -> None:
    assert reading(consent=stated) is True


@pytest.mark.parametrize(
    "stated",
    [
        False,
        "false",
        "no",
        "n",
        "0",
        "",
        "   ",
        "pending",
        "withdrawn",
        "revoked",
        "unknown",
        "expired",
        None,
        0,
        [],
    ],
)
def test_anything_other_than_a_yes_is_not_consent(stated: object) -> None:
    assert reading(consent=stated) is False


def test_a_record_that_never_mentions_consent_has_none() -> None:
    """Absence is not agreement. They are still migrated, just not put into Global search."""
    assert reading() is False


def test_a_consent_date_alone_is_not_consent() -> None:
    """A date says when something was recorded, not that the answer was yes."""
    assert reading(consent_date="2025-03-01") is False


def test_the_accounts_own_field_name_is_read_too() -> None:
    assert reading(is_consent_given=True) is True
    assert reading(consent_status="granted") is True
