from __future__ import annotations

from http import HTTPStatus
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PROBLEM_JSON_MEDIA_TYPE = "application/problem+json"

BLANK_PROBLEM_TYPE = "about:blank"

PROBLEM_TYPE_PREFIX = "urn:sync:problem:"

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
TENANT_SLUG_TAKEN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-slug-taken"
RECRUITER_ONLY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}recruiter-only"
RECRUITER_DEACTIVATED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}recruiter-deactivated"
TENANT_SUSPENDED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-suspended"
TENANT_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-not-found"
TENANT_ADMIN_ONLY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-admin-only"
INVITE_ALREADY_ACCEPTED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invite-already-accepted"
LAST_TENANT_ADMIN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}last-tenant-admin"
MEMBER_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}member-not-found"
CANDIDATE_ONLY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}candidate-only"
PLATFORM_ADMIN_ONLY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}platform-admin-only"
UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unknown-canonical-skill"
UNKNOWN_LANGUAGE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unknown-language"
UNKNOWN_LOCATION_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unknown-location"
UNKNOWN_CANONICAL_ROLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unknown-canonical-role"
MALFORMED_SKILL_FILTER_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}malformed-skill-filter"
MALFORMED_LANGUAGE_FILTER_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}malformed-language-filter"
SEARCHABLE_NEEDS_A_COMPLETE_PROFILE_PROBLEM_TYPE = (
    f"{PROBLEM_TYPE_PREFIX}searchable-needs-a-complete-profile"
)
CV_MEDIA_TYPE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unsupported-cv-media-type"
CV_TOO_LARGE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-too-large"
CV_EMPTY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-empty"
INVALID_CV_FILENAME_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invalid-cv-filename"
DUPLICATE_CV_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}duplicate-cv"
CV_LIMIT_REACHED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-limit-reached"
CV_IS_CURRENT_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-is-current"
CV_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-not-found"
CV_FILE_UNAVAILABLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-file-unavailable"
AVATAR_MEDIA_TYPE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unsupported-avatar-media-type"
AVATAR_TOO_LARGE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}avatar-too-large"
AVATAR_EMPTY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}avatar-empty"
TENANT_LOGO_MEDIA_TYPE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}unsupported-tenant-logo-media-type"
TENANT_LOGO_TOO_LARGE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-logo-too-large"
TENANT_LOGO_EMPTY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tenant-logo-empty"
STORAGE_UNAVAILABLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}storage-unavailable"
NOTIFICATION_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}notification-not-found"
SEARCH_UNAVAILABLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}search-unavailable"
INVALID_CURSOR_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invalid-cursor"
JOB_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}job-not-found"
JOB_CRITERIA_LOCKED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}job-criteria-locked"
JOB_PLACE_REQUIRED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}job-place-required"
JOB_WORK_MODE_REQUIRED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}job-work-mode-required"
JOB_TRANSITION_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}job-transition-not-allowed"
TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tracked-link-name-taken"
TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tracked-link-not-found"
CV_NOT_READY_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}cv-not-ready"
NO_CURRENT_CV_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}no-current-cv"
INCOMPLETE_PROFILE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}incomplete-profile"
DUPLICATE_APPLICATION_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}duplicate-application"
INVALID_APPLICATION_ANSWERS_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}invalid-application-answers"
APPLICATION_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}application-not-found"
APPLICATION_TRANSITION_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}application-transition-not-allowed"
HIRE_CLAIM_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}hire-claim-not-found"
HIRE_CLAIM_ALREADY_ANSWERED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}hire-claim-already-answered"
TAG_NAME_TAKEN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tag-name-taken"
TAG_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tag-not-found"
TAG_SCOPE_MISMATCH_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}tag-scope-mismatch"
CANDIDATE_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}candidate-not-found"
NOTE_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}note-not-found"
ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}assessment-unavailable"
ASSESSMENT_FAILED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}assessment-failed"
MESSAGE_TEMPLATE_NAME_TAKEN_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}message-template-name-taken"
MESSAGE_TEMPLATE_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}message-template-not-found"
ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}access-request-not-found"
ACCESS_REQUEST_ALREADY_DECIDED_PROBLEM_TYPE = f"{PROBLEM_TYPE_PREFIX}access-request-already-decided"


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


class SubmissionRefusedProblemDetail(ProblemDetail):
    """A submission refused either by its answers or by the profile behind it."""

    errors: list[InvalidField] = Field(
        default_factory=list,
        description="Every answer that failed validation. Empty when the profile is what is "
        "missing — `detail` says what.",
    )


class CvConflictProblemDetail(ProblemDetail):
    """An upload refused by the CVs the candidate already keeps."""

    cv_id: UUID | None = Field(
        default=None,
        description="The CV already holding this exact file. Only on a duplicate.",
    )


class ApplicationConflictProblemDetail(ProblemDetail):
    """A submission refused by the state something is already in."""

    application_id: UUID | None = Field(
        default=None,
        description="The Application already holding this job. Only on a duplicate.",
    )


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
