"""Turning a phone number somebody typed into the pair the platform stores.

`profiles` holds a number as E.164 and its country separately, and its CHECKs are strict: the
number matches `^\\+[1-9][0-9]{1,14}$`, the country is two capitals, and either both are present
or neither is. A number written for a human — spaces, brackets, a leading 00, a local number with
no country at all — satisfies none of that, so it has to be read before it can be written.

Which country a bare local number belongs to is not in the number. It comes from the account
being migrated, which is why the region is a setting the operator sees rather than a constant
buried here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final

import phonenumbers

#: The platform's own two CHECKs, so a number this module accepts cannot fail the insert.
E164: Final = re.compile(r"^\+[1-9][0-9]{1,14}$")
ISO_COUNTRY: Final = re.compile(r"^[A-Z]{2}$")

#: Where a local number is assumed to be from when it carries no country of its own.
DEFAULT_REGION: Final = "SY"


@dataclass(frozen=True, slots=True)
class Phone:
    """A number the platform will accept, and the country it was read as."""

    number: str
    country: str


def as_phone(value: str | None, *, region: str = DEFAULT_REGION) -> Phone | None:
    """The number as the platform stores it, or None where the text is not a usable number.

    None is the honest answer for the unusable: a profile with no phone is merely incomplete,
    while a profile with a wrong one is misleading, and the operator can be told the count.
    """
    written = (value or "").strip()
    if not written:
        return None

    for candidate in _readings(written):
        found = _parsed(candidate, region)
        if found is not None:
            return found
    return None


def _readings(written: str) -> tuple[str, ...]:
    """The same text as its plausible international forms, most explicit first.

    `00` and `011` are how an international number gets dialled out of most of the world; a
    number written that way means its country, and reading it as local would file it under
    whichever country the operator happened to configure.
    """
    trimmed = written.lstrip("(").replace(")", "", 1) if written.startswith("(+") else written
    readings = [trimmed]
    digits = re.sub(r"[^\d+]", "", trimmed)
    for prefix in ("00", "011"):
        if digits.startswith(prefix) and len(digits) > len(prefix):
            readings.append(f"+{digits[len(prefix) :]}")
    return tuple(dict.fromkeys(readings))


def _parsed(written: str, region: str) -> Phone | None:
    try:
        # An explicit `+` carries its own country; anything else is read as local to `region`.
        parsed = phonenumbers.parse(written, None if written.startswith("+") else region)
    except phonenumbers.NumberParseException:
        return None

    if not phonenumbers.is_valid_number(parsed):
        return None

    number = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    country = phonenumbers.region_code_for_number(parsed)
    # A valid number can still belong to a calling code shared by several countries, and there
    # is no country to write for it. Neither column can go in without the other.
    if country is None or not ISO_COUNTRY.match(country) or not E164.match(number):
        return None
    return Phone(number=number, country=country)
