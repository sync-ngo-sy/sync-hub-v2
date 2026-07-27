"""The shape a professional profile is allowed to take.

Numbers rather than types, because the two things that need them need them differently.
`sync_api.candidates.payload` builds pydantic constraints out of them and *refuses* a
profile that breaks one — a candidate typed it, so a client error naming the field is the
right answer. `sync_ingestion` *coerces* to them instead: the AI wrote that profile, and a
hallucinated year is not something to refuse the whole parse over.

Same limits either way, which is the point of them being here. A parse the review screen
cannot post back to `PUT /v1/candidates/me/profile` would be a parse nobody can accept, and
that is exactly what two copies of these numbers would eventually produce.
"""

from __future__ import annotations

from typing import Final

#: How many entries one section may carry. Not a schema limit — the schema has none — but
#: the profile is embedded whole for Global search, and a section nobody could have typed
#: is a way to make that work unboundedly expensive.
MAX_ENTRIES: Final = 50

#: `candidate_skills.years_experience` is `numeric(4,1)`: anything larger overflows the
#: column, and anything more precise is rounded away on the way in.
MAX_YEARS_EXPERIENCE: Final = 999.9
YEARS_EXPERIENCE_DECIMALS: Final = 1

#: The `*_year_range` CHECKs on every dated `candidate_*` table.
EARLIEST_YEAR: Final = 1900
LATEST_YEAR: Final = 2100

MAX_LINE_LENGTH: Final = 200
MAX_PARAGRAPH_LENGTH: Final = 5000
MAX_LINK_LENGTH: Final = 2000
