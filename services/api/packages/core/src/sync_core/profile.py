from __future__ import annotations

import re
from decimal import Decimal
from typing import Final

MAX_ENTRIES: Final = 50

#: `candidate_skills.years_experience` is `numeric(4,1)`; anything larger overflows.
MAX_YEARS_EXPERIENCE: Final = 999.9
YEARS_EXPERIENCE_DECIMALS: Final = 1

EARLIEST_YEAR: Final = 1900
LATEST_YEAR: Final = 2100

MAX_LINE_LENGTH: Final = 200
MAX_PARAGRAPH_LENGTH: Final = 5000
MAX_LINK_LENGTH: Final = 2000

#: The control characters no text column can hold meaningfully — Postgres refuses a NUL
#: outright — and no screen has a use for. Tab, newline and carriage return are content.
CONTROL_CHARACTERS: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def as_decimal(years: float) -> Decimal:
    """Through `str`, so `numeric(4,1)` stores the number that was typed, not its float."""
    return Decimal(str(years))
