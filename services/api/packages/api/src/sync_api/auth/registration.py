"""Minting an identity, and taking it back when the rest of a signup fails.

Two flows create an account from nothing — a Candidate signing up for themselves and a
hiring company self-serving a Tenant — and both face the same problem: GoTrue owns the
identity, Postgres owns everything else, and no transaction spans the two. Both solve it
the same way, which is why the solution lives here rather than twice.

The order is the whole trick. The identity is created *first* and deleted again if anything
downstream fails; `profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`, so
removing the identity removes whatever the flow had already written. A failure therefore
leaves no half-built account — only an address that is free to sign up again.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sync_api.auth.gotrue import EmailAlreadyRegisteredError, WeakPasswordError
from sync_api.problems import (
    EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
    WEAK_PASSWORD_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger

if TYPE_CHECKING:
    from collections.abc import AsyncIterator
    from uuid import UUID

    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)


async def create_identity(gotrue: GoTrue, *, email: str, password: str) -> GoTrueUser:
    """The unconfirmed identity a signup starts from, with GoTrue's refusals translated."""
    try:
        return await gotrue.create_user(email=email, password=password)
    except EmailAlreadyRegisteredError as exc:
        raise email_already_registered() from exc
    except WeakPasswordError as exc:
        raise weak_password() from exc


@asynccontextmanager
async def identity_undone_on_failure(gotrue: GoTrue, user_id: UUID) -> AsyncIterator[None]:
    """Delete `user_id` if the block raises, cascading away everything it had written.

    Catches `BaseException`, not `Exception`: a cancelled request abandons a signup just as
    thoroughly as a failed one does, and leaves the same stranded identity behind.

    Only for an identity this request *created*. A flow that may be holding one GoTrue
    handed it without creating it — inviting, whose endpoint re-invites an existing
    unconfirmed user — has to decide case by case, and calls `undo_identity` itself.
    """
    try:
        yield
    except BaseException:
        await undo_identity(gotrue, user_id)
        raise


async def undo_identity(gotrue: GoTrue, user_id: UUID) -> None:
    """Delete an identity, and everything `ON DELETE CASCADE` hangs off it.

    Never raises. The caller is already failing for a better reason, and a rollback that
    could fail the request a second time would only obscure the first.
    """
    try:
        await gotrue.delete_user(user_id)
    except Exception:
        # Reported, not raised: this line is what tells an operator that an identity was
        # stranded after all, and which one.
        logger.exception("auth.signup_rollback_failed", profile_id=str(user_id))


def email_already_registered() -> Problem:
    """One address, one account — whether the account it already has is a Candidate or a
    Recruiter. `auth.users` is what upholds the Candidate-XOR-Recruiter rule across signup,
    tenant signup and invitation alike, so no flow needs a check of its own."""
    return Problem(
        status=409,
        type=EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
        detail="An account already exists for this email address.",
    )


def weak_password() -> Problem:
    return Problem(
        status=400,
        type=WEAK_PASSWORD_PROBLEM_TYPE,
        detail="That password does not meet the identity provider's requirements.",
    )
