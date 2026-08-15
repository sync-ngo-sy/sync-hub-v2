from __future__ import annotations

from pydantic import BaseModel, Field


class JobCounts(BaseModel):
    """The tenant's Jobs, by the state each one is in. Every Job is in exactly one, so the four
    states sum to `total`."""

    total: int
    draft: int
    published: int
    closed: int
    archived: int
    published_last_week: int = Field(
        description="Jobs that first went live in the last 7 days. A Job closed and republished "
        "counts for the week it originally went live, not this one."
    )


class PipelineStatusCounts(BaseModel):
    """Every status of the Pipeline, including the ones nobody is working any more.

    The tenant's own eight, not the five a Candidate reads: this is the internal pipeline, and
    a Stage is what the other side is told. Complete on purpose — the parts sum to the total,
    so a reader can add up whichever subset they mean by "in play" without the API having
    decided that for them.
    """

    new: int
    reviewing: int
    shortlisted: int
    interview: int
    offer: int
    hired: int
    rejected: int
    withdrawn: int


class QualificationCounts(BaseModel):
    """Every Screening verdict, `pending` included — a verdict not yet reached is not a failure."""

    pending: int
    qualified: int
    disqualified: int
    review_required: int


class ApplicationCounts(BaseModel):
    """The tenant's Applications: how many, how recently, and where they stand."""

    total: int
    last_24h: int = Field(description="Received in the last 24 hours.")
    last_7d: int = Field(description="Received in the last 7 days.")
    previous_7d: int = Field(
        description="Received in the 7 days before `last_7d`, which is what makes a week-on-week "
        "comparison possible."
    )
    by_status: PipelineStatusCounts
    by_qualification: QualificationCounts
    pass_rate: int | None = Field(
        description="The percentage of screened Applications that qualified, 0-100. Null when "
        "Screening has decided nothing: a rate over nothing says nothing."
    )


class Source(BaseModel):
    """Where a tenant's Job views came from: one named channel, added up across every Job.

    A tracked link's name is unique per Job rather than per Tenant, so the same campaign run on
    nine Jobs is nine links and one Source.
    """

    name: str = Field(
        description="The tracked link's name, or `Direct` for visitors who arrived without one."
    )
    views: int


class TenantStats(BaseModel):
    """Everything the Recruiter Dashboard counts, in one read.

    The windows are rolling rather than calendar — `last_7d` is the last 168 hours, not this week
    so far. A Tenant has no timezone, so a calendar day would have to be computed in one, and the
    wrong one turns a recruiter's morning into yesterday.
    """

    jobs: JobCounts
    applications: ApplicationCounts
    sources: list[Source] = Field(
        description="The busiest channels, ranked, and never more than six — enough for the card "
        "that draws them. `sources_total` says how many there are in all."
    )
    sources_total: int = Field(
        description="Every distinct Source the tenant has, including channels that brought no "
        "views at all and the ones ranked below the six returned."
    )
