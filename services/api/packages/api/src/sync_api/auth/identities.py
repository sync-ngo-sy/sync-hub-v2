from __future__ import annotations

from typing import TYPE_CHECKING

from sync_core.models import User

if TYPE_CHECKING:
    from sqlalchemy import ColumnElement


def by_address(email: str) -> tuple[ColumnElement[bool], ...]:
    """The identity holding this address, read through the one index `auth.users` has for it.

    `users_email_partial_key` is unique on `email` where `is_sso_user = false`, and both halves of
    that shape matter. `lower(email) = ...` cannot use it — a function on the column makes the
    index unusable, so asking that way sequentially scanned every user on the platform — and it
    bought nothing, because the identity provider stores every address lowercased already.
    (`tests/integration/test_auth_signup.py` holds it to that rather than trusting it.) Naming
    `is_sso_user` is what lets the planner use a *partial* index at all: without it the query does
    not imply the index's predicate. This platform mints no SSO identities, so the rows it
    excludes are rows that do not exist.
    """
    return (User.email == email.strip().lower(), User.is_sso_user.is_(False))
