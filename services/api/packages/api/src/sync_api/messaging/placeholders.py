from __future__ import annotations

import re
from dataclasses import dataclass, fields
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Iterable

_PLACEHOLDER: Final = re.compile(r"\{\{(?P<name>[^{}]*)\}\}")


@dataclass(frozen=True, slots=True)
class Placeholders:
    """Everything a Message template may name, and what one send fills each with.

    Declaring the set once as these fields is what keeps `KNOWN` — which save time validates
    against — from ever admitting a name send time could not resolve.
    """

    candidate_name: str
    job_title: str
    tenant_name: str

    def fill(self, template: str) -> str:
        values = {field.name: getattr(self, field.name) for field in fields(self)}
        return _PLACEHOLDER.sub(lambda found: values[_named(found)], template)


KNOWN: Final = tuple(field.name for field in fields(Placeholders))


def as_written(names: Iterable[str]) -> str:
    """The names as a recruiter writes them, for saying which ones a template may use."""
    return ", ".join(f"`{{{{ {name} }}}}`" for name in names)


def unknown_in(template: str) -> list[str]:
    """Every placeholder the text names that a send could not fill, in the order written.

    A malformed one lands here too: `{{ Job Title }}` names nothing resolvable, and saying so at
    save time is the whole point of refusing it there.
    """
    named = (_named(found) for found in _PLACEHOLDER.finditer(template))
    return list(dict.fromkeys(name for name in named if name not in KNOWN))


def _named(found: re.Match[str]) -> str:
    """Whitespace inside the braces is the recruiter's, so `{{name}}` and `{{ name }}` are one."""
    return found.group("name").strip()
