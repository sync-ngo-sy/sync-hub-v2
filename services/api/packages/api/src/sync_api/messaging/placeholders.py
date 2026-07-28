from __future__ import annotations

import re
from dataclasses import dataclass, fields
from typing import Final

_PLACEHOLDER: Final = re.compile(r"\{\{(?P<name>[^{}]*)\}\}")


@dataclass(frozen=True, slots=True)
class Placeholders:
    """Everything a Message template may name, and what one send fills each with.

    The fixed set is these fields: declaring them once is what keeps `KNOWN` — which save time
    validates against — from ever naming something send time could not resolve.
    """

    candidate_name: str
    job_title: str
    tenant_name: str

    def fill(self, template: str) -> str:
        """The template as the Candidate will read it. Whitespace inside the braces is the
        recruiter's own typing, so `{{name}}` and `{{ name }}` are the same placeholder."""
        values = {field.name: getattr(self, field.name) for field in fields(self)}
        return _PLACEHOLDER.sub(lambda found: values[_named(found)], template)


KNOWN: Final = tuple(field.name for field in fields(Placeholders))

SYNTAX: Final = ", ".join(f"`{{{{ {name} }}}}`" for name in KNOWN)


def unknown_in(*templates: str) -> list[str]:
    """Every placeholder the text names that a send could not fill, in the order written.

    Malformed ones land here too — `{{ Job Title }}` names nothing this can resolve, and saying
    so at save time is the whole point of rejecting it there.
    """
    named = (_named(found) for template in templates for found in _PLACEHOLDER.finditer(template))
    return list(dict.fromkeys(name for name in named if name not in KNOWN))


def _named(found: re.Match[str]) -> str:
    return found.group("name").strip()
