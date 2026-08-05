from __future__ import annotations

from typing import TYPE_CHECKING

from sync_core.models import User

if TYPE_CHECKING:
    from sqlalchemy import ColumnElement


def by_address(email: str) -> tuple[ColumnElement[bool], ...]:
    return (User.email == email.strip().lower(), User.is_sso_user.is_(False))
