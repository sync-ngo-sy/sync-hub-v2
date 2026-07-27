from __future__ import annotations

from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_parsers.extractor import Vocabulary

PARSED_CV_SCHEMA_VERSION: Final = 1

INSTRUCTIONS: Final = """\
You are reading one candidate's CV for a recruitment platform. Extract what the document \
actually says into the given schema.

Rules:
- Report only what the CV supports. Where it says nothing, answer null, or an empty list. \
Never infer, round up, or fill a gap with something plausible.
- `skills` may only contain names from the Canonical skills list below, spelled exactly as \
listed. Map an equivalent the CV uses onto its canonical name — "JS" is "JavaScript".
- Every other skill, technology or tool the CV names goes in `unmapped_skills`, in the \
CV's own words. A skill you cannot map belongs there; it does not belong in `skills` \
under an approximate name.
- `years_experience` is only for a figure the CV supports — a stated number, or one that \
follows from dated jobs where the skill is named. Otherwise null.
- `languages[].code` may only be a code from the language codes list below.
- Keep descriptions in the CV's own wording rather than rewriting them, and translate \
nothing: `detected_language` records what language the CV is written in.

Canonical skills:
{canonical_skills}

Language codes:
{language_codes}
"""


def parse_instructions(vocabulary: Vocabulary) -> str:
    return INSTRUCTIONS.format(
        canonical_skills=_as_list(vocabulary.canonical_skills),
        language_codes=_as_list(vocabulary.language_codes),
    )


def _as_list(names: Sequence[str]) -> str:
    return ", ".join(names) if names else "(none)"
