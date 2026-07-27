from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from sync_api.candidates import (
    CandidateProfile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.jobs import PublicTenant
from sync_api.text import OptionalLine, OptionalParagraph
from sync_core.models import (
    ApplicationQuestionType,
    ApplicationStatus,
    QualificationStatus,
    StatusChangeSource,
)
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


class ApplicationSummary(BaseModel):
    """One Application, as the Job's triage list shows it."""

    id: UUID = Field(description="The Application. Read it for everything below the surface.")
    candidate_name: str = Field(description="The Snapshot's name: who they applied as.")
    headline: OptionalLine = None
    location: OptionalLine = None
    status: ApplicationStatus
    qualification_status: QualificationStatus = Field(description="The Screening verdict.")
    applied_at: datetime
    updated_at: datetime


class ApplicationSummaryPage(BaseModel):
    """One page of a Job's Applications, newest first."""

    items: list[ApplicationSummary]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )


class ApplicationSnapshot(BaseModel):
    """The reviewed data as it was frozen when the Application was sent, and never since."""

    full_name: str
    phone: OptionalLine = None
    headline: OptionalLine = None
    summary: OptionalParagraph = None
    location: OptionalLine = None

    experiences: list[ProfileExperience] = Field(default_factory=list)
    educations: list[ProfileEducation] = Field(default_factory=list)
    skills: list[ProfileSkill] = Field(default_factory=list)
    languages: list[ProfileLanguage] = Field(default_factory=list)
    projects: list[ProfileProject] = Field(default_factory=list)


class AnsweredQuestion(BaseModel):
    """One of the Job's questions, and what the Candidate answered."""

    question_id: UUID
    question_text: str
    question_type: ApplicationQuestionType
    answer_boolean: bool | None = None
    answer_text: str | None = None


class ScreeningVerdict(BaseModel):
    """What Screening decided, and why. A status change never touches it."""

    status: QualificationStatus
    reason: str | None = Field(
        default=None, description="Which criteria decided it. Null until Screening has run."
    )


class StatusHistoryEntry(BaseModel):
    """One move in the Application's life, and who made it."""

    status: ApplicationStatus
    previous_status: ApplicationStatus | None = Field(
        default=None, description="Null on the first entry: the submission itself."
    )
    source: StatusChangeSource
    changed_at: datetime


class ApplicationCv(BaseModel):
    """The CV this Application was sent with, and where to read the original."""

    id: UUID
    display_name: str = Field(description="The name of the file the candidate uploaded.")
    download_url: str = Field(
        description="A signed URL to the original file. Anyone holding it can read it, so it "
        "is short-lived — read the Application again rather than storing it."
    )
    expires_in_seconds: int = Field(description="How long `download_url` stays good for.")


class ReviewedJob(BaseModel):
    """The Job an Application is being read against."""

    id: UUID
    title: str


class ApplicationReview(BaseModel):
    """One Application, whole: everything reviewing it takes, and no other tool."""

    id: UUID
    job: ReviewedJob
    status: ApplicationStatus
    screening: ScreeningVerdict
    snapshot: ApplicationSnapshot
    answers: list[AnsweredQuestion]
    history: list[StatusHistoryEntry] = Field(description="Every move it has made, oldest first.")
    cv: ApplicationCv
    applied_at: datetime
    updated_at: datetime


class ApplicationStatusChange(BaseModel):
    """Where to take the Application next."""

    status: ApplicationStatus = Field(
        description="Where it goes. `withdrawn` is refused here: leaving is the candidate's "
        "own move, and theirs alone."
    )


class MovedApplication(BaseModel):
    """Where an Application stands after a move, and where it came from."""

    id: UUID
    status: ApplicationStatus
    previous_status: ApplicationStatus
    changed_at: datetime
