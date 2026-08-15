"""One reachable number, read the same way wherever the platform reads one.

The browser runs libphonenumber over what a Candidate types and the API runs the same rules over
what it sends, so a number the browser accepted is never one the API then refuses — and a number
that arrives another way meets exactly the browser's standard.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

import phonenumbers

NO_COUNTRY: Final = "001"


@dataclass(frozen=True, slots=True)
class Phone:
    """A number a Profile may hold: the ISO country it belongs to, beside it in E.164."""

    country: str
    number: str


def read(number: str, country: str | None = None) -> Phone | None:
    """`number` as the platform stores it, or None when that country cannot dial it.

    `country` is an answer to check the number against rather than one to derive from it: `+1`
    is twenty-odd countries, and a number belonging to the neighbour who shares a calling code
    is refused here rather than quietly re-labelled.

    A Phone belongs to a country. `+800` international freephone and the satellite ranges belong
    to no country, so libphonenumber answers `001` for them and this refuses them — a Profile has
    nowhere to put that, and the browser, whose libphonenumber answers nothing at all, agrees.
    """
    try:
        parsed = phonenumbers.parse(number, country)
    except phonenumbers.NumberParseException:
        return None

    if not phonenumbers.is_valid_number(parsed):
        return None

    home = phonenumbers.region_code_for_number(parsed)
    if home is None or home == NO_COUNTRY:
        return None
    if country is not None and home != country:
        return None

    return Phone(
        country=home,
        number=phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164),
    )
