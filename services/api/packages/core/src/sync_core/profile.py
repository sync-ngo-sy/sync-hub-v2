from __future__ import annotations

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
