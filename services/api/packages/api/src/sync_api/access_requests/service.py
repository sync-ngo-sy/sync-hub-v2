from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select, update
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

        The decision is written inside the transaction that provisions the Tenant, so the two
        land together or not at all. Anything else leaves a state nobody can get out of: a
        conversion that fails after the Tenant is committed keeps the request pending, and
        retrying it then fails forever on the address already being registered.
        """
        request = await self._pending_request(request_id)

        async def record_the_decision(session: AsyncSession, tenant_id: UUID) -> None:
            await self._decide(
                session, request_id, AccessRequestStatus.CONVERTED, tenant_id=tenant_id
            )

        created = await self._platform.create_tenant(
            name=request.company,
            slug=slug,
            email=request.email,
            full_name=request.full_name,
            in_the_same_commit=record_the_decision,
        )

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
        async with transaction(self._db):
            await self._decide(self._db, request_id, AccessRequestStatus.DISMISSED)

        logger.info("access_requests.dismissed", access_request_id=str(request_id))
        return _request_from(request)

    async def _pending_request(self, request_id: UUID) -> AccessRequest:
        """Read the ask so the operator is refused before anybody is invited. Not a lock, and not
        relied on as one: `_decide` is what settles which of two decisions actually happened."""
        request = await self._db.get(AccessRequest, request_id)
        if request is None:
            raise Problem(
                status=404,
                type=ACCESS_REQUEST_NOT_FOUND_PROBLEM_TYPE,
                detail="No access request with that id.",
            )
        if request.status is not AccessRequestStatus.PENDING:
            raise _already_decided()
        return request

    async def _decide(
        self,
        session: AsyncSession,
        request_id: UUID,
        status: AccessRequestStatus,
        *,
        tenant_id: UUID | None = None,
    ) -> None:
        """Take the request and write the decision, refusing if somebody decided it first.

        `status = pending` in the WHERE clause is the lock: Postgres re-checks it under the row
        lock it takes, so of two decisions arriving together exactly one matches a row. The other
        matches none, raises, and takes its caller's whole transaction down with it.
        """
        decided = await session.execute(
            update(AccessRequest)
            .where(
                AccessRequest.id == request_id,
                AccessRequest.status == AccessRequestStatus.PENDING,
            )
            .values(status=status, tenant_id=tenant_id, decided_at=datetime.now(UTC))
            .returning(AccessRequest.id)
        )
        if decided.one_or_none() is None:
            raise _already_decided()


def _already_decided() -> Problem:
    return Problem(
        status=409,
        type=ACCESS_REQUEST_ALREADY_DECIDED_PROBLEM_TYPE,
        detail="This access request has already been dealt with.",
    )


def _request_from(row: AccessRequest) -> AccessRequestRecord:
    return AccessRequestRecord(
        id=row.id,
        company=row.company,
        full_name=row.full_name,
        email=row.email,
        created_at=row.created_at,
    )
