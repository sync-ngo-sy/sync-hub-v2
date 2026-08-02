from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from sync_api.auth.gotrue import EmailAlreadyRegisteredError, WeakPasswordError
from sync_api.integrity import violated_constraint
from sync_api.problems import (
    EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
    WEAK_PASSWORD_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import User

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)

PROFILE_CONSTRAINT: Final = "profiles_pkey"


async def create_identity(gotrue: GoTrue, *, email: str, password: str) -> GoTrueUser:
    try:
        return await gotrue.create_user(email=email, password=password)
    except EmailAlreadyRegisteredError as exc:
        raise email_already_registered() from exc
    except WeakPasswordError as exc:
        raise weak_password() from exc


async def invite_identity(
    gotrue: GoTrue, session: AsyncSession, *, email: str, redirect_to: str
) -> GoTrueUser:
    """The identity behind an invitation, for whoever is about to be provisioned onto it.

    The address is ruled out first so that the undo in `identity_undone_unless_taken` can only
    reach an identity this request created — deleting any other would take the account hanging
    off it too.
    """
    if await _email_is_taken(session, email):
        raise email_already_registered()

    try:
        return await gotrue.invite_user(email=email, redirect_to=redirect_to)
    except EmailAlreadyRegisteredError as exc:
        raise email_already_registered() from exc


@asynccontextmanager
async def identity_undone_on_failure(gotrue: GoTrue, user_id: UUID) -> AsyncGenerator[None]:
    try:
        yield
    except BaseException:
        await undo_identity(gotrue, user_id)
        raise


@asynccontextmanager
async def identity_undone_unless_taken(gotrue: GoTrue, user_id: UUID) -> AsyncGenerator[None]:
    """Undo the invited identity if provisioning fails — unless the Profile's own key is what
    refused, which means the identity is not this request's to delete.

    That looks unreachable, the address having been ruled out moments earlier, and is not: two
    requests inviting the same address both pass that check, and GoTrue answers the second with
    the *same* user it minted for the first rather than a new one. The second then loses on
    `profiles_pkey`, and the identity it would be deleting is the account the first just made.
    """
    try:
        yield
    except BaseException as exc:
        if isinstance(exc, IntegrityError) and violated_constraint(exc) == PROFILE_CONSTRAINT:
            raise email_already_registered() from exc
        await undo_identity(gotrue, user_id)
        raise


async def _email_is_taken(session: AsyncSession, email: str) -> bool:
    found = await session.scalar(select(User.id).where(func.lower(User.email) == email.lower()))
    return found is not None


async def undo_identity(gotrue: GoTrue, user_id: UUID) -> None:
    try:
        await gotrue.delete_user(user_id)
    except Exception:
        logger.exception("auth.signup_rollback_failed", profile_id=str(user_id))


def email_already_registered() -> Problem:
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
