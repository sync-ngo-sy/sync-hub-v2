from __future__ import annotations

from typing import TYPE_CHECKING, Final, cast
from uuid import UUID

from sync_core.models import ManatalImportJob, ManatalImportJobKind, ManatalImportJobStatus
from sync_manatal.client import ManatalUnavailableError
from sync_manatal.importer import ManatalImportResult, ManatalImporting
from sync_worker.engine import PermanentFailureError, Queue

if TYPE_CHECKING:
    from sqlalchemy import Table
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_worker.engine import ClaimedJob

MANATAL_IMPORT_QUEUE: Final = Queue(
    name="manatal_import",
    table=cast("Table", ManatalImportJob.__table__),
    pending=ManatalImportJobStatus.PENDING,
    processing=ManatalImportJobStatus.PROCESSING,
    completed=ManatalImportJobStatus.COMPLETED,
    failed=ManatalImportJobStatus.FAILED,
)


class ManatalImportConsumer:
    def __init__(self, importing: ManatalImporting) -> None:
        self._importing = importing

    @property
    def queue(self) -> Queue:
        return MANATAL_IMPORT_QUEUE

    async def perform(self, job: ClaimedJob) -> ManatalImportResult:
        tenant_id = _tenant_id(job)
        recruiter_id = _recruiter_id(job)
        kind = ManatalImportJobKind(job.row["kind"])
        manatal_candidate_id = job.row["manatal_candidate_id"]
        try:
            if kind == ManatalImportJobKind.PLAN:
                return await self._importing.plan(tenant_id, recruiter_id)
            if kind == ManatalImportJobKind.IMPORT:
                if manatal_candidate_id is None:
                    raise PermanentFailureError("import job has no Manatal candidate id")
                return await self._importing.import_one(
                    tenant_id, recruiter_id, manatal_candidate_id
                )
            if manatal_candidate_id is None:
                raise PermanentFailureError("publish job has no Manatal candidate id")
            return await self._importing.publish_one(tenant_id, recruiter_id, manatal_candidate_id)
        except ManatalUnavailableError as unreachable:
            raise unreachable
        except PermanentFailureError:
            raise
        except Exception as error:
            if kind != ManatalImportJobKind.PLAN and _is_settled(error):
                return ManatalImportResult(kind, manatal_candidate_id=manatal_candidate_id)
            raise

    async def record(
        self, session: AsyncSession, job: ClaimedJob, result: ManatalImportResult
    ) -> None:
        return None

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        await self._importing.give_up(
            session,
            tenant_id=_tenant_id(job),
            kind=ManatalImportJobKind(job.row["kind"]),
            manatal_candidate_id=job.row["manatal_candidate_id"],
            reason=reason,
        )


def _tenant_id(job: ClaimedJob) -> UUID:
    tenant_id: UUID = job.row["tenant_id"]
    return tenant_id


def _recruiter_id(job: ClaimedJob) -> UUID:
    recruiter_id: UUID = job.row["recruiter_id"]
    return recruiter_id


def _is_settled(error: Exception) -> bool:
    from sync_manatal.auth import AddressTakenError
    from sync_manatal.client import ResumeMissingError

    return isinstance(error, AddressTakenError | ResumeMissingError)
