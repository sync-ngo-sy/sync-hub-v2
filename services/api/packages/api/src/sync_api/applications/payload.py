from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Final
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from sync_api.candidates import (
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.jobs import PublicTenant
from sync_api.jobs.access import location_name
from sync_api.text import (
    LocationName,
    OptionalIsoCountry,
    OptionalLine,
    OptionalLink,
    OptionalParagraph,
)
from sync_core.models import (
    ApplicationQuestionType,
    ApplicationStatus,
    EmploymentType,
    HireConfirmation,
    Job,
    QualificationStatus,
    StatusChangeSource,
    WorkMode,
)
from sync_core.profile import MAX_ENTRIES
from sync_core.stages import ApplicationStage


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
    """One submission: the Job, and the answers to the questions it asks.

    Nothing else. The Snapshot is copied server-side from the caller's live profile and the CV
    they currently hold, so there is no way to apply with data the profile does not have.
    """

    job_id: UUID
    answers: list[SubmittedAnswer] = Field(
        default_factory=list,
        max_length=MAX_ENTRIES,
        description="One answer per question. Every required question needs one.",
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
    location_key: str | None = None
    location_name: LocationName = None
    employment_type: EmploymentType | None = None
    work_mode: WorkMode | None = None


class HireClaim(BaseModel):
    """A Tenant's claim to have hired somebody, and what the Candidate said about it.

    Only a `confirmed` one is a Placement. A claim they have not answered is still only a
    claim, and nothing counts it.
    """

    start_date: date = Field(description="The day the Tenant says the work started.")
    confirmation: HireConfirmation = Field(
        description="The Candidate's answer. `unanswered` until they give one."
    )
    claimed_at: datetime = Field(description="When the Tenant said so.")
    answered_at: datetime | None = Field(
        default=None, description="When the Candidate answered. Null while they have not."
    )


class HireAnswer(BaseModel):
    """The Candidate's answer to a claimed hire. It is given once and stands."""

    confirmed: bool = Field(description="True if they did start the job the Tenant named.")


class Application(BaseModel):
    """One of the caller's own Applications.

    Never the Tenant's internal status, and never the Screening verdict: a Candidate reads the
    Stage their Application has reached, and what a Job screened on is the Recruiter's to say.
    """

    id: UUID
    job: AppliedJob
    cv_id: UUID
    stage: ApplicationStage = Field(
        description="How far this has got. Everything a Tenant does between arrival and a "
        "decision reads as `in_review`."
    )
    can_withdraw: bool = Field(
        description="Whether leaving is still possible. False once the Application has an "
        "outcome, and once it has been withdrawn."
    )
    hire: HireClaim | None = Field(
        default=None,
        description="The hire this Tenant claims, when it claims one. An `unanswered` claim is "
        "the Candidate's to confirm or deny.",
    )
    applied_at: datetime
    updated_at: datetime


class ApplicationPage(BaseModel):
    """One page of the caller's Applications, newest first."""

    items: list[Application]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )


class MatchScore(BaseModel):
    """The Application's reading, as a list row carries it: the number, and enough of the words
    behind it that the number is never shown on its own.

    The whole reading — its strengths and its gaps — is on the Application review. This is what
    a row can hold under a pointer or a focus ring.
    """

    model_config = ConfigDict(protected_namespaces=())

    percentage: float = Field(
        description="How strong this applicant is for this Job, 0 to 100 — about half how well "
        "they answer what the Job asks for, and half how strong the Application reads in "
        "itself. Advice: it neither is nor changes the Screening verdict."
    )
    explanation: str | None = Field(default=None, description="Why, in the model's own words.")
    model_name: str = Field(description="The model that wrote it.")
    assessed_at: datetime


class ApplicationSummary(BaseModel):
    """One Application, as the Job's triage list shows it."""

    id: UUID = Field(description="The Application. Read it for everything below the surface.")
    candidate_name: str = Field(description="The Snapshot's name: who they applied as.")
    headline: OptionalLine = None
    location: OptionalLine = None
    canonical_role: OptionalLine = Field(
        default=None,
        description="What the Candidate's Canonical role was called the day they applied. Null "
        "when they claimed none, which is when a list has only the `headline` to name them by.",
    )
    total_experience_years: int = Field(
        description="Whole years of work as the profile stood the day this was sent — the same "
        "number Screening measured against the Job's minimum.",
    )
    status: ApplicationStatus
    qualification_status: QualificationStatus = Field(description="The Screening verdict.")
    match: MatchScore | None = Field(
        default=None,
        description="The AI's reading of this Application. Null while no model has managed one "
        "— the reading is enqueued as the Application arrives, so this fills in shortly after, "
        "and stays null only if every attempt failed.",
    )
    applied_at: datetime
    updated_at: datetime


class ApplicationStatusCount(BaseModel):
    """How many Applications of the list being read stand in one Pipeline status."""

    status: ApplicationStatus
    count: int


class ApplicationVerdictCount(BaseModel):
    """How many of the Job's Applications the Screening verdict decided one way."""

    verdict: QualificationStatus
    count: int


class ApplicationSummaryPage(BaseModel):
    """One page of a Job's Applications, newest first."""

    items: list[ApplicationSummary]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )
    status_counts: list[ApplicationStatusCount] = Field(
        default_factory=list,
        description="Every Pipeline status the platform has, in Pipeline order, each with how "
        "many of the Job's Applications stand in it. Counted before `status` narrows anything, "
        "so a filter that hides some of them still says how many it is hiding. The other "
        "filters do narrow it: the counts describe the list the reader is looking at.",
    )
    verdict_counts: list[ApplicationVerdictCount] = Field(
        default_factory=list,
        description="Every Screening verdict the platform has, each with how many of the Job's "
        "Applications it decided that way. Counted before `qualification_status` narrows "
        "anything, so a filter that hides some of them still says how much it is hiding. The "
        "other filters do narrow it: the counts describe the list the reader is looking at.",
    )


class ApplicationJob(BaseModel):
    """The Job an Application came in for, as a list spanning every Job has to name it."""

    id: UUID
    title: str
    location_name: LocationName = None
    work_mode: WorkMode | None = Field(
        default=None,
        description="How the Job is worked. With no `location_name`, `remote` is what makes the "
        "Job's place read as Anywhere rather than as nothing at all.",
        examples=[WorkMode.REMOTE],
    )

    @classmethod
    def of(cls, job: Job) -> ApplicationJob:
        """The Job as a row names it. Loaded `WITH_LOCATION`, or its place reads as nothing."""
        return cls(
            id=job.id, title=job.title, location_name=location_name(job), work_mode=job.work_mode
        )


class TenantApplicationSummary(ApplicationSummary):
    """One Application in the tenant's own list.

    Carries its Job, which a Job's own triage list can leave implied and this one cannot: every
    row here may have come from a different Job.
    """

    job: ApplicationJob


class ReceivedWithin(StrEnum):
    """The rolling windows the tenant's Application list can be narrowed to.

    Rolling rather than calendar, exactly as the Dashboard's counts are: `7d` is the last 168
    hours rather than this week so far. A Tenant has no timezone, so a calendar week would have
    to be computed in one, and the wrong one turns a Recruiter's morning into yesterday.
    """

    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"


RECEIVED_WITHIN_DAYS: Final[dict[ReceivedWithin, int]] = {
    ReceivedWithin.DAY: 1,
    ReceivedWithin.WEEK: 7,
    ReceivedWithin.MONTH: 30,
}


class ApplicationSort(StrEnum):
    """The orders an Application list can be read in.

    Two run on `applied_at`, which is the one date a row here shows. The other two run on the
    Match score, so a Job with hundreds of Applications can be read best-answered first rather
    than only newest first. Each names the answer it gives rather than a column and a direction.

    An Application nobody has read yet has no score, and sorts below every one that has: last
    under `highest_match`, and first under `lowest_match`, where "nothing to show" belongs
    beside the weakest readings rather than hidden past them.
    """

    NEWEST = "newest"
    OLDEST = "oldest"
    HIGHEST_MATCH = "highest_match"
    LOWEST_MATCH = "lowest_match"


class TenantApplicationPage(BaseModel):
    """One page of the tenant's Applications, in the order that was asked for, across every Job."""

    items: list[TenantApplicationSummary]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )
    status_counts: list[ApplicationStatusCount] = Field(
        default_factory=list,
        description="Every Pipeline status the platform has, in Pipeline order, each with how "
        "many of the tenant's Applications stand in it. Counted before `status` narrows "
        "anything, so a filter that hides some of them still says how many it is hiding. The "
        "other filters do narrow it: the counts describe the list the reader is looking at.",
    )
    verdict_counts: list[ApplicationVerdictCount] = Field(
        default_factory=list,
        description="Every Screening verdict the platform has, each with how many of the "
        "tenant's Applications it decided that way. Counted before `qualification_status` "
        "narrows anything, so a filter that hides some of them still says how much it is "
        "hiding. The other filters do narrow it: the counts describe the list the reader is "
        "looking at.",
    )


class TenantHireClaim(BaseModel):
    """One Hire claim as the Tenant's own list of them reads it.

    Only a `confirmed` one is a Placement. The other two are here to be read rather than
    counted: nothing about an unanswered claim lapses, and a denied one moves nothing.
    """

    application_id: UUID = Field(
        description="The Application the claim was made on. Read it for who applied, what they "
        "sent, and what the Tenant has done since."
    )
    candidate_name: str = Field(description="The Snapshot's name: who they applied as.")
    job: ApplicationJob = Field(description="The Job they were hired for.")
    start_date: date = Field(description="The day the Tenant says the work started.")
    confirmation: HireConfirmation = Field(
        description="The Candidate's answer. `unanswered` until they give one, and they may "
        "never give one."
    )
    claimed_at: datetime = Field(
        description="When the Tenant said so, which is what the age of an unanswered claim is "
        "measured from."
    )
    answered_at: datetime | None = Field(
        default=None, description="When the Candidate answered. Null while they have not."
    )


class HireClaimCount(BaseModel):
    """How many of the Tenant's Hire claims stand one of the three ways."""

    confirmation: HireConfirmation
    count: int


class FilterableJob(BaseModel):
    """One Job the Placements page's Job filter can name."""

    id: UUID
    title: str


class TenantHireClaimPage(BaseModel):
    """One page of the Tenant's Hire claims of one standing, newest claim first."""

    items: list[TenantHireClaim]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )
    counts: list[HireClaimCount] = Field(
        default_factory=list,
        description="Every standing a Hire claim can have, each with how many of the Tenant's "
        "claims stand that way. Counted whichever standing `confirmation` narrows the list to, "
        "so each of them says its own size while another is being read. `job_id` does narrow "
        "them, because a tab that named a size the list cannot show would be counting other "
        "Jobs' claims.",
    )
    jobs: list[FilterableJob] = Field(
        default_factory=list,
        description="What the Job filter can name, by title: every Job this Tenant has claimed "
        "a hire on, whatever the standing, and the Job `job_id` names even if nobody was ever "
        "claimed on it — a Job's own Placements count opens this page on a zero, and a filter "
        "that could not name what it was showing would read as broken. Never narrowed by the "
        "Job that was chosen, so choosing one cannot empty the picker it was chosen from.",
    )


class ApplicationSnapshot(BaseModel):
    """The candidate's profile as it was frozen when the Application was sent, and never since."""

    full_name: str
    phone: OptionalLine = Field(default=None, description="In E.164, as it was that day.")
    phone_country: OptionalIsoCountry = None
    headline: OptionalLine = None
    summary: OptionalParagraph = None
    location: OptionalLine = None
    canonical_role: OptionalLine = Field(
        default=None,
        description="What the Candidate's Canonical role was called the day they applied. Null "
        "when they claimed none.",
    )
    unmapped_skills: list[str] = Field(
        default_factory=list,
        description="Skills the candidate claims that the platform has no Canonical name for. "
        "Screening never read them; a human reading the Application should.",
    )
    linkedin_url: OptionalLink = None
    github_url: OptionalLink = None
    portfolio_url: OptionalLink = Field(
        default=None,
        description="The Links as they were the day the Application was sent. Screening never "
        "read them either; a Recruiter reviewing the Application does.",
    )
    total_experience_years: int = Field(
        default=0,
        description="Whole years of work as the profile stood the day this was sent. The number "
        "Screening measured against the Job's minimum, and the one its verdict cites.",
    )

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
        default=None,
        description=(
            "Which criteria decided it. Null while the verdict is `pending`, and null on a "
            "`qualified` one too: a reason lists what fell short, and nothing did."
        ),
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


class ReviewedCandidate(BaseModel):
    """Who applied, as they stand today — and only the two facts a Snapshot cannot freeze.

    Everything a Recruiter judges by is read off the `snapshot`. These two are not there
    because freezing them would be a lie: only the authentication store holds a confirmed
    address, and an avatar is a file that moves rather than a value that was true once.
    """

    id: UUID
    email: str | None = Field(
        default=None,
        description="Read from the authentication store, which is the only place a confirmed "
        "address lives. Null when the account has none.",
    )
    avatar_url: str | None = None


class ApplicationReview(BaseModel):
    """One Application, whole: everything reviewing it takes, and no other tool."""

    id: UUID
    job: ReviewedJob
    candidate: ReviewedCandidate
    status: ApplicationStatus
    screening: ScreeningVerdict
    snapshot: ApplicationSnapshot
    answers: list[AnsweredQuestion]
    history: list[StatusHistoryEntry] = Field(description="Every move it has made, oldest first.")
    hire: HireClaim | None = Field(
        default=None,
        description="The hire this Tenant claimed, and whether the Candidate has confirmed it. "
        "A claim they have not answered is not a Placement.",
    )
    cv: ApplicationCv
    told_at: datetime | None = Field(
        default=None,
        description="The Telling: when this Application's rejection reaches the Candidate, "
        "three days after it was taken. A moment still ahead is a decision they have not "
        "seen; one behind is a decision they have read. It survives a reopen, so a Telling on "
        "anything but a `rejected` Application is the record of what the Candidate was once "
        "told. Null on an Application never rejected.",
    )
    applied_at: datetime
    updated_at: datetime


class MatchAssessment(BaseModel):
    """The AI's reading of how well an Application answers its Job.

    Advice a Recruiter weighs, and nothing more: it is drawn from the Snapshot and the Job's
    criteria, and it never touches the Screening verdict. One per Application — asking again
    replaces it, and nothing removes it.
    """

    # Pydantic reserves the `model_` prefix for its own members; `model_name` is what the
    # audit trail calls the model, and renaming it here would only hide that.
    model_config = ConfigDict(protected_namespaces=())

    id: UUID
    match_percentage: float = Field(
        description="How strong this applicant is for this Job, 0 to 100 — about half how well "
        "they answer what the Job asks for, and half how strong the Application reads in "
        "itself. Not a probability, and not a verdict."
    )
    explanation: str | None = Field(default=None, description="Why, in the model's own words.")
    strengths: list[str] = Field(
        default_factory=list, description="The requirements it answers well, one phrase each."
    )
    gaps: list[str] = Field(
        default_factory=list, description="The requirements it does not, one phrase each."
    )
    model_name: str = Field(description="The model that wrote it.")
    prompt_version: str = Field(description="The prompt it was written under.")
    assessed_at: datetime = Field(description="When it was last read.")
    first_assessed_at: datetime = Field(
        description="When the Application was first read. The same as `assessed_at` until a "
        "Recruiter asks for a better reading."
    )


class ApplicationStatusChange(BaseModel):
    """Where to take the Application next."""

    status: ApplicationStatus = Field(
        description="Where it goes. `withdrawn` is refused here: leaving is the candidate's "
        "own move, and theirs alone."
    )
    start_date: date | None = Field(
        default=None,
        description="The day the work started. Required by `hired` and refused by every other "
        "status: a hire is a claim about a particular day, and the Candidate is asked to "
        "confirm that day.",
    )

    @model_validator(mode="after")
    def _a_hire_names_the_day_it_started(self) -> ApplicationStatusChange:
        hiring = self.status is ApplicationStatus.HIRED
        if hiring and self.start_date is None:
            raise ValueError("marking somebody hired needs the day they started")
        if not hiring and self.start_date is not None:
            raise ValueError(f"a {self.status.value} application has no start date")
        return self


class MovedApplication(BaseModel):
    """Where an Application stands after a move, where it came from, and what the Candidate
    heard about it."""

    id: UUID
    status: ApplicationStatus
    previous_status: ApplicationStatus
    candidate_notified: bool = Field(
        description="Whether this move reached the Candidate at once. False when it left the "
        "Stage they read unchanged — which is every move among the undecided statuses — and "
        "false for a rejection, which reaches them at its Telling three days later."
    )
    told_at: datetime | None = Field(
        default=None,
        description="The Telling this Application now carries. Ahead of now on a rejection "
        "just taken; behind it on one the Candidate has already read. Null on an Application "
        "never rejected.",
    )
    changed_at: datetime


class WithdrawnApplication(BaseModel):
    """Where the caller's own Application stands after they left it."""

    id: UUID
    stage: ApplicationStage
    previous_stage: ApplicationStage
    changed_at: datetime
