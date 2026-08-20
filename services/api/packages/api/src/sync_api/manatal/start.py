from __future__ import annotations

from typing import TYPE_CHECKING, NoReturn

from sync_api.manatal.payload import ManatalMigrationAction, ManatalMigrationStartResponse
from sync_api.problems import (
    MANATAL_NOT_AUTHORIZED_PROBLEM_TYPE,
    MANATAL_NOT_CONFIGURED_PROBLEM_TYPE,
    Problem,
)
from sync_core import transaction
from sync_manatal.importer import enqueue_plan, enqueue_publish_batch

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_core import Settings


class ManatalMigrationStartService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._db = session
        self._settings = settings

    async def start(
        self, recruiter: ActingRecruiter, action: ManatalMigrationAction
    ) -> ManatalMigrationStartResponse:
        self._ensure_may_start(recruiter)
        async with transaction(self._db):
            if action == ManatalMigrationAction.IMPORT:
                await enqueue_plan(
                    self._db,
                    tenant_id=recruiter.tenant.id,
                    recruiter_id=recruiter.profile.id,
                )
                return ManatalMigrationStartResponse(action=action, jobs_enqueued=1)
            enqueued = await enqueue_publish_batch(
                self._db,
                tenant_id=recruiter.tenant.id,
                recruiter_id=recruiter.profile.id,
            )
            return ManatalMigrationStartResponse(action=action, jobs_enqueued=enqueued)

    def _ensure_may_start(self, recruiter: ActingRecruiter) -> None:
        if self._settings.manatal_api_token is None or self._settings.manatal_recruiter_id is None:
            _refuse_not_configured()
        if recruiter.profile.id != self._settings.manatal_recruiter_id:
            _refuse_not_authorized()


def _refuse_not_configured() -> NoReturn:
    raise Problem(
        status=503,
        type=MANATAL_NOT_CONFIGURED_PROBLEM_TYPE,
        title="Manatal import is not configured",
        detail="This environment has no Manatal credentials. Ask your platform team to set them.",
    )


def _refuse_not_authorized() -> NoReturn:
    raise Problem(
        status=403,
        type=MANATAL_NOT_AUTHORIZED_PROBLEM_TYPE,
        title="This tenant cannot start a Manatal import",
        detail="Only the tenant whose recruiter id matches MANATAL_RECRUITER_ID may start a batch.",
    )
