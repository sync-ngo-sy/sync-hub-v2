from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from sync_api.problems import (
    ACCESS_REQUEST_ALREADY_DECIDED_PROBLEM_TYPE,
    ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import AccessRequest, AccessRequestStatus

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.platform import CreatedTenant, PlatformService

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class AccessRequestRecord:
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

    async def submit(self, *, company: str, full_name: str, email: str) -> None:
        """Record what a visitor typed, and answer nothing.

        Asking again from the same address while the first ask is still pending is *ignored*
        rather than applied: the first ask stands. Nobody proves they own an address here, so an
        upsert would let a stranger who knows a waiting address rewrite the company and the name
        the operator reads — and the company is what the Tenant gets called on conversion.
        Either way the visitor is told the same thing, and the operator keeps one row per address.
        """
        address = email.strip().lower()
        async with transaction(self._db):
            recorded = await self._db.scalar(
                insert(AccessRequest)
                .values(company=company, full_name=full_name, email=address)
                .on_conflict_do_nothing(
                    index_elements=[AccessRequest.email],
                    index_where=AccessRequest.status == AccessRequestStatus.PENDING,
                )
                .returning(AccessRequest.id)
            )

        logger.info(
            "access_requests.submitted",
            access_request_id=str(recorded) if recorded else None,
            already_waiting=recorded is None,
        )

    async def pending(self) -> list[AccessRequestRecord]:
        """The queue: everything still waiting on a decision, oldest first."""
        rows = await self._db.scalars(
            select(AccessRequest)
            .where(AccessRequest.status == AccessRequestStatus.PENDING)
            .order_by(AccessRequest.created_at, AccessRequest.id)
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

    async def dismiss(self, request_id: UUID) -> AccessRequestRecord:
        """Take a request off the queue without opening anything. The row stays, so the same
        company asking again is visibly a second ask rather than a first one."""
        request = await self._pending_request(request_id)
        await self._decide(request, AccessRequestStatus.DISMISSED)

        logger.info("access_requests.dismissed", access_request_id=str(request_id))
        return _request_from(request)

    async def _pending_request(self, request_id: UUID) -> AccessRequest:
        request = await self._db.get(AccessRequest, request_id)
        if request is None:
            raise Problem(
                status=404,
                type=ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE,
                detail="No access request with that id.",
            )
        if request.status is not AccessRequestStatus.PENDING:
            raise Problem(
                status=409,
                type=ACCESS_REQUEST_ALREADY_DECIDED_PROBLEM_TYPE,
                detail="This access request has already been dealt with.",
            )
        return request

    async def _decide(
        self,
        request: AccessRequest,
        status: AccessRequestStatus,
        *,
        tenant_id: UUID | None = None,
    ) -> None:
        async with transaction(self._db):
            request.status = status
            request.tenant_id = tenant_id
            request.decided_at = datetime.now(UTC)


def _request_from(row: AccessRequest) -> AccessRequestRecord:
    return AccessRequestRecord(
        id=row.id,
        company=row.company,
        full_name=row.full_name,
        email=row.email,
        created_at=row.created_at,
    )
