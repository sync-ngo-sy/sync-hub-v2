from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Final

from pydantic import AfterValidator, BeforeValidator, Field, StringConstraints

from sync_core.links import github_address, linkedin_address, portfolio_address
from sync_core.profile import MAX_LINE_LENGTH, MAX_LINK_LENGTH, MAX_PARAGRAPH_LENGTH

#: Backslash rather than the default, which is `%` itself and cannot then escape one.
LIKE_ESCAPE: Final = "\\"


def containing(term: str) -> str:
    """A search term as a substring pattern. `%` and `_` are wildcards to the database and
    ordinary characters to whoever typed them, so they are escaped rather than honoured."""
    escaped = (
        term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", f"{LIKE_ESCAPE}%")
        .replace("_", f"{LIKE_ESCAPE}_")
    )
    return f"%{escaped}%"


def _blank_as_unset(value: object) -> object:
    """An empty input on a form means "not set", not "set to nothing"."""
    return None if isinstance(value, str) and not value.strip() else value


Line = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LINE_LENGTH)
]
Paragraph = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_PARAGRAPH_LENGTH)
]
Link = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LINK_LENGTH)
]

OptionalLine = Annotated[Line | None, BeforeValidator(_blank_as_unset)]
OptionalParagraph = Annotated[Paragraph | None, BeforeValidator(_blank_as_unset)]
OptionalLink = Annotated[Link | None, BeforeValidator(_blank_as_unset)]


def _normalized(normalize: Callable[[str], str]) -> Callable[[str | None], str | None]:
    """One Link normalizer as a validator: the same rule the ingestion holds a parse to."""

    def validate(value: str | None) -> str | None:
        return None if value is None else normalize(value)

    return validate


LinkedInUrl = Annotated[
    OptionalLink,
    AfterValidator(_normalized(linkedin_address)),
    Field(
        description="The candidate's LinkedIn. A handle on its own is stored as the whole "
        "address; anything that is not a LinkedIn profile is refused.",
        examples=["https://www.linkedin.com/in/amina-haddad"],
    ),
]

GitHubUrl = Annotated[
    OptionalLink,
    AfterValidator(_normalized(github_address)),
    Field(
        description="The candidate's GitHub. A username on its own is stored as the whole "
        "address, and a repository as the account that owns it.",
        examples=["https://github.com/amina-haddad"],
    ),
]

PortfolioUrl = Annotated[
    OptionalLink,
    AfterValidator(_normalized(portfolio_address)),
    Field(
        description="The candidate's own site. Stored as a browser would open it; only `http` "
        "and `https` addresses are accepted.",
        examples=["https://amina-haddad.dev"],
    ),
]

LanguageCode = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=8),
    Field(description="A code from the platform's `languages` table.", examples=["en"]),
]

LocationKey = Annotated[
    OptionalLine,
    Field(
        description="A key from the platform's `locations` table, which `/v1/locations` lists. "
        "Null says nothing about where this is.",
        examples=["sy-aleppo"],
    ),
]

CanonicalRoleKey = Annotated[
    OptionalLine,
    Field(
        description="A key from the platform's `canonical_roles` table, which `/v1/roles` lists. "
        "Null says nobody has claimed a role, not that the CV was silent.",
        examples=["frontend-engineer"],
    ),
]

#: Read-only, and never a way to set one: a Location is chosen by key and named by the taxonomy.
LocationName = Annotated[
    str | None,
    Field(
        description="What `location_key` is called. Null when there is no Location.",
        examples=["Aleppo"],
    ),
]
