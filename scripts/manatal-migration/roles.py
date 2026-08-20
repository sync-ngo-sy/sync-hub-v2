"""Matching a job title somebody typed to the role taxonomy the platform stores.

`canonical_role_key` is one of the ten facts a complete profile holds, and the platform never
lets it be typed — the candidate picks from `/roles` or leaves it unset. Manatal has no such list:
it has whatever was written in a "Current position" box. So a migration either matches that text
to the taxonomy or leaves the field empty, and an empty one keeps the candidate out of Global
search.

Matching is deliberately narrow. A confident wrong role is worse than none: it files somebody
under work they do not do, and a Recruiter searching that role finds the wrong person. So the
rules below only ever tighten — exact name, then the key's own words, then every word of a
taxonomy name present in the title — and anything less certain than that is no match.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Mapping

#: Words that say nothing about what kind of practitioner somebody is.
NOISE: Final = frozenset(
    {
        "a",
        "an",
        "and",
        "at",
        "for",
        "in",
        "of",
        "the",
        "to",
        "assistant",
        "associate",
        "chief",
        "deputy",
        "head",
        "intern",
        "junior",
        "lead",
        "mid",
        "principal",
        "senior",
        "sr",
        "jr",
        "staff",
        "trainee",
        "vice",
    }
)

_WORDS: Final = re.compile(r"[a-z0-9+#]+")


def role_key_of(typed: str | None, taxonomy: Mapping[str, str]) -> str | None:
    """The taxonomy key this title names, or None where nothing is certain enough.

    `taxonomy` is keyed by lowercased role name, as `role_keys` reads it.
    """
    written = (typed or "").strip().lower()
    if not written:
        return None

    exact = taxonomy.get(written)
    if exact:
        return exact

    said = _significant(written)
    if not said:
        return None

    # Every word of the role's name is in the title: "Senior Backend Engineer" holds all of
    # "Backend Engineer". Longest name first, so "Backend Engineer" is preferred to "Engineer".
    for name in sorted(taxonomy, key=len, reverse=True):
        wanted = _significant(name)
        if wanted and wanted <= said:
            return taxonomy[name]
    return None


def _significant(text: str) -> frozenset[str]:
    """The words that carry the meaning, seniority and grammar removed.

    Seniority is not a role: a senior engineer and a junior engineer are the same kind of
    practitioner, and the platform holds how long they have worked separately.
    """
    return frozenset(word for word in _WORDS.findall(text.lower()) if word not in NOISE)
