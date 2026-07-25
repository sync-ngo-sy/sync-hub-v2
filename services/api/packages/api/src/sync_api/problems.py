"""RFC 9457 problem details — the single shape every API error takes.

Clients parse one thing whether a route 404s, a body fails validation, or something
blows up. Domain errors added by later tickets raise `Problem` with their own `type` URN
rather than inventing a second error shape.

ADR-0007 says reach for a library, and this is the one place in the service where the
search came up empty, so: the candidates were `fastapi-problem` (35 GitHub stars) and
`fastapi-rfc9457` (v0.2.1, ~1k downloads a month). Both fit technically. Neither is
established enough to hand the error contract of every endpoint to — a dependency this
central has to be one that will still be maintained in three years, and the ~250 lines here
plus `errors.py` are the cheaper risk. Recheck when something in this space grows up; the
wire format is the RFC's, so a swap would not move the contract.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

PROBLEM_JSON_MEDIA_TYPE = "application/problem+json"

#: A problem with no more specific type, per RFC 9457 §4.2.1.
BLANK_PROBLEM_TYPE = "about:blank"

#: URNs, so problem types stay stable identifiers without owning a URL that has to resolve.
PROBLEM_TYPE_PREFIX = "urn:sync:problem:"

# Every problem type the API can answer with, in one place: a client switching on `type` is
# switching on this list, so it is as much a contract as the route table.
VALIDATION_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}validation-error"
CSRF_HEADER_REQUIRED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}csrf-header-required"
RATE_LIMITED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}rate-limited"
NOT_AUTHENTICATED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}not-authenticated"
INVALID_CREDENTIALS_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invalid-credentials"
EMAIL_NOT_CONFIRMED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}email-not-confirmed"
EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}email-already-registered"
INVALID_EMAIL_TOKEN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invalid-email-token"
WEAK_PASSWORD_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}weak-password"
PASSWORD_UNCHANGED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}password-unchanged"
IDENTITY_UNAVAILABLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}identity-provider-unavailable"


class ProblemDetail(BaseModel):
    """The body of any error response."""

    model_config = ConfigDict(extra="allow")

    type: str = Field(
        default=BLANK_PROBLEM_TYPE,
        description="Stable identifier for what went wrong.",
        examples=[BLANK_PROBLEM_TYPE],
    )
    title: str = Field(description="Short, human-readable summary of the problem type.")
    status: int = Field(description="The HTTP status code, repeated for out-of-band handling.")
    detail: str | None = Field(default=None, description="Explanation specific to this occurrence.")
    instance: str | None = Field(
        default=None, description="Path of the request that produced the problem."
    )
    request_id: str | None = Field(
        default=None, description="Correlates this response with the server logs."
    )


class InvalidField(BaseModel):
    """One rejected input, located by where it appeared in the request."""

    location: str = Field(
        description="Dotted path to the offending value, e.g. `body.email`.",
        examples=["body.email"],
    )
    message: str = Field(description="Why the value was rejected.")
    type: str = Field(description="Machine-readable validation rule that failed.")


class ValidationProblemDetail(ProblemDetail):
    """A problem that can name every input it rejected."""

    errors: list[InvalidField] = Field(description="Every field that failed validation.")


class Problem(Exception):  # noqa: N818  — it *is* a problem; the RFC's noun, not an "Error"
    """Raise to answer a request with a specific problem+json response."""

    def __init__(
        self,
        *,
        status: int,
        detail: str | None = None,
        type: str = BLANK_PROBLEM_TYPE,  # noqa: A002  — RFC 9457 names this member `type`
        title: str | None = None,
        headers: dict[str, str] | None = None,
        **extensions: Any,
    ) -> None:
        self.status = status
        self.title = title or title_for(status)
        self.detail = detail
        self.type = type
        self.headers = headers or {}
        self.extensions = extensions
        super().__init__(self.detail or self.title)


def title_for(status: int) -> str:
    """The status code's standard reason phrase, which RFC 9457 wants as the title."""
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"
