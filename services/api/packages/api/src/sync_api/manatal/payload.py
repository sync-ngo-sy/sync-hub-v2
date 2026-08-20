from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class ManatalMigrationAction(StrEnum):
    IMPORT = "import"
    PUBLISH = "publish"


class ManatalMigrationStartRequest(BaseModel):
    action: ManatalMigrationAction = Field(
        description="Start bringing candidates across from Manatal, or publish parsed profiles."
    )


class ManatalMigrationStartResponse(BaseModel):
    action: ManatalMigrationAction
    jobs_enqueued: int = Field(description="How many worker jobs this request queued.")


class ManatalMigrationQueueCounts(BaseModel):
    ledger_pending: int = Field(description="Manatal candidates not yet imported.")
    ledger_imported: int = Field(description="Imported candidates waiting to be published.")
    jobs_pending: int = Field(description="Worker jobs waiting to run.")
    jobs_processing: int = Field(description="Worker jobs running now.")
    jobs_failed: int = Field(description="Worker jobs that failed and will not retry.")


class ManatalMigrationCounts(BaseModel):
    """How far a Manatal import has got for one Tenant's talent pool."""

    total: int = Field(description="Candidates in the pool who were brought across from Manatal.")
    published: int = Field(
        description="Imported candidates whose profiles were written and are searchable."
    )
    complete: int = Field(description="Imported candidates with a complete profile marker.")
    unclaimed: int = Field(
        description="Imported candidates whose account nobody has signed into yet."
    )
    awaiting_parse: int = Field(
        description="Imported candidates whose CV the platform has not finished reading."
    )
    parse_failed: int = Field(description="Imported candidates whose CV could not be read.")
    with_linkedin: int = Field(description="Imported candidates with a LinkedIn address on file.")


class ManatalMigrationRecent(BaseModel):
    """One imported candidate, as the status page needs them."""

    candidate_id: str
    full_name: str
    email: str
    is_claimed: bool
    is_searchable: bool
    parsing_status: str | None = Field(
        description="The current CV's parse state, or null when there is no current CV."
    )
    saved_at: str = Field(description="When this Tenant first saved them to the talent pool.")


class ManatalMigrationStatus(BaseModel):
    """Everything a tenant admin needs to see how a Manatal import is going."""

    configured: bool = Field(
        description="Whether this deployment has Manatal credentials and a recruiter id set."
    )
    may_start: bool = Field(
        description="Whether the signed-in tenant admin may start import or publish batches."
    )
    counts: ManatalMigrationCounts
    queue: ManatalMigrationQueueCounts
    recent: list[ManatalMigrationRecent] = Field(
        description="The twenty most recently saved imported candidates."
    )
