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
- `canonical_role` is the one exception to the rule above, and the only judgement asked \
for here: pick the key from the Canonical roles list that best describes the line of work \
this CV is about, even though the CV does not use that word. Judge it from the jobs held \
and the work described, not from a job title alone. Where the CV shows no clear line of \
work — too little to go on, or an even split between two — answer null; the candidate is \
shown this and can choose for themselves. Never answer a key that is not in the list.
- `languages[].code` may only be a code from the language codes list below.
- Keep descriptions in the CV's own wording rather than rewriting them, and translate \
nothing: `detected_language` records what language the CV is written in.

Canonical skills:
{canonical_skills}

Canonical roles:
{canonical_roles}

Language codes:
{language_codes}
"""


def parse_instructions(vocabulary: Vocabulary) -> str:
    return INSTRUCTIONS.format(
        canonical_skills=_as_list(vocabulary.canonical_skills),
        canonical_roles=_as_list(vocabulary.canonical_roles),
        language_codes=_as_list(vocabulary.language_codes),
    )


def _as_list(names: Sequence[str]) -> str:
    return ", ".join(names) if names else "(none)"
