from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from sync_api.problems import (
    ACCESS_REQUEST_DECIDED_PROBLEM_TYPE,
    ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import AccessRequest as AccessRequestRow
from sync_core.models import AccessRequestStatus

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.platform import CreatedTenant, PlatformService

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class AccessRequest:
    """A company asking to be given Sync, as the Platform admin working the queue sees it."""

    id: UUID
    company: str
    full_name: str
    email: str
    created_at: datetime


class AccessRequestService:
    """The queue between a company asking for Sync and the Tenant a Platform admin opens for it."""

    def __init__(self, session: AsyncSession, platform: PlatformService) -> None:
        self._db = session
        self._platform = platform

    async def submit(self, *, company: str, full_name: str, email: str) -> AccessRequest:
        """Record what a visitor typed. Asking again from the same address while the first ask is
        still pending revises it rather than queueing a second one — the visitor is told the same
        thing either way, and the operator works one row per company."""
        address = email.strip().lower()
        async with transaction(self._db):
            rows = await self._db.scalars(
                insert(AccessRequestRow)
                .values(company=company, full_name=full_name, email=address)
                .on_conflict_do_update(
                    index_elements=[AccessRequestRow.email],
                    index_where=AccessRequestRow.status == AccessRequestStatus.PENDING,
                    set_={"company": company, "full_name": full_name},
                )
                .returning(AccessRequestRow)
            )
            row = rows.one()

        logger.info("access_requests.submitted", access_request_id=str(row.id))
        return _request_from(row)

    async def pending(self) -> list[AccessRequest]:
        """The queue: everything still waiting on a decision, oldest first."""
        rows = await self._db.scalars(
            select(AccessRequestRow)
            .where(AccessRequestRow.status == AccessRequestStatus.PENDING)
            .order_by(AccessRequestRow.created_at, AccessRequestRow.id)
        )
        return [_request_from(row) for row in rows]

    async def convert(self, request_id: UUID, *, slug: str) -> CreatedTenant:
        """Open the Tenant this request asked for and invite the founding admin it named.

        Nothing is retyped: the company, the name and the address all come from the row. The
        address is the one thing the visitor could not tell us, because it is ours to hand out.
        """
        request = await self._pending_request(request_id)
        created = await self._platform.create_tenant(
            name=request.company,
            slug=slug,
            email=request.email,
            full_name=request.full_name,
        )
        await self._decide(request, AccessRequestStatus.CONVERTED, tenant_id=created.tenant.id)

        logger.info(
            "access_requests.converted",
            access_request_id=str(request_id),
            tenant_id=str(created.tenant.id),
        )
        return created

    async def dismiss(self, request_id: UUID) -> AccessRequest:
        """Take a request off the queue without opening anything. The row stays, so the same
        company asking again is visibly a second ask rather than a first one."""
        request = await self._pending_request(request_id)
        await self._decide(request, AccessRequestStatus.DISMISSED)

        logger.info("access_requests.dismissed", access_request_id=str(request_id))
        return _request_from(request)

    async def _pending_request(self, request_id: UUID) -> AccessRequestRow:
        request = await self._db.get(AccessRequestRow, request_id)
        if request is None:
            raise Problem(
                status=404,
                type=ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE,
                detail="No access request with that id.",
            )
        if request.status is not AccessRequestStatus.PENDING:
            raise Problem(
                status=409,
                type=ACCESS_REQUEST_DECIDED_PROBLEM_TYPE,
                detail="This access request has already been dealt with.",
            )
        return request

    async def _decide(
        self,
        request: AccessRequestRow,
        status: AccessRequestStatus,
        *,
        tenant_id: UUID | None = None,
    ) -> None:
        async with transaction(self._db):
            request.status = status
            request.tenant_id = tenant_id
            request.decided_at = datetime.now(UTC)


def _request_from(row: AccessRequestRow) -> AccessRequest:
    return AccessRequest(
        id=row.id,
        company=row.company,
        full_name=row.full_name,
        email=row.email,
        created_at=row.created_at,
    )
