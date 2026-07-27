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
    try:
        return await gotrue.create_user(email=email, password=password)
    except EmailAlreadyRegisteredError as exc:
        raise email_already_registered() from exc
    except WeakPasswordError as exc:
        raise weak_password() from exc


@asynccontextmanager
async def identity_undone_on_failure(gotrue: GoTrue, user_id: UUID) -> AsyncIterator[None]:
    try:
        yield
    except BaseException:
        await undo_identity(gotrue, user_id)
        raise


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
