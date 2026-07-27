from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from sync_api.candidates import CandidateProfile
from sync_api.jobs import PublicTenant
from sync_api.text import OptionalParagraph
from sync_core.models import ApplicationStatus
from sync_core.profile import MAX_ENTRIES


class SubmittedAnswer(BaseModel):
    """One answer to one of the Job's questions, in the kind the question asked for."""

    question_id: UUID
    answer_boolean: bool | None = Field(
        default=None, description="The answer to a `yes_no` question."
    )
    answer_text: OptionalParagraph = Field(
        default=None, description="The answer to a `short_text` question."
    )

    @model_validator(mode="after")
    def _one_kind_of_answer(self) -> SubmittedAnswer:
        """The `aans_one_answer_kind` CHECK, restated."""
        if (self.answer_boolean is None) == (self.answer_text is None):
            raise ValueError("an answer is either a yes/no or some text, and never both")
        return self


class NewApplication(BaseModel):
    """One submission: the Job, the CV behind it, the reviewed data, and the answers."""

    job_id: UUID
    cv_id: UUID = Field(description="A CV of the caller's that has finished parsing.")
    profile: CandidateProfile = Field(
        description="The data the candidate reviewed. Captured as the Snapshot this Application "
        "is judged and read by, and never changed afterwards."
    )
    answers: list[SubmittedAnswer] = Field(
        default_factory=list,
        max_length=MAX_ENTRIES,
        description="One answer per question. Every required question needs one.",
    )
    update_profile: bool = Field(
        default=False,
        description="Also replace the live profile with the reviewed data, in the same "
        "transaction — one review improving both.",
    )

    @model_validator(mode="after")
    def _one_answer_per_question(self) -> NewApplication:
        # Caught here rather than by the composite primary key, which would refuse the
        # submission half way through with a message about a constraint.
        asked = [str(answer.question_id) for answer in self.answers]
        repeated = sorted({question for question in asked if asked.count(question) > 1})
        if repeated:
            raise ValueError(f"one answer per question; repeated: {', '.join(repeated)}")
        return self


class AppliedJob(BaseModel):
    """The Job an Application went to, as the candidate's own list names it."""

    id: UUID
    title: str
    tenant: PublicTenant
    location: str | None = None
    employment_type: str | None = None


class Application(BaseModel):
    """One of the caller's own Applications.

    Never the Screening verdict: what a Job screened on and how it landed is the Recruiter's
    to say, not something a candidate reads off their own dashboard.
    """

    id: UUID
    job: AppliedJob
    cv_id: UUID
    status: ApplicationStatus
    applied_at: datetime
    updated_at: datetime


class ApplicationPage(BaseModel):
    """One page of the caller's Applications, newest first."""

    items: list[Application]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )
