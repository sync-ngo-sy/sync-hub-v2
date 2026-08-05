"""The check ADR-0002 calls for.

Deny-by-default is the whole of the database's own defence: RLS enabled on every `public`
table, no policies anywhere, and no grants for the two client roles. Migration 09 sets that up
by looping over the tables that existed when it ran, so every table added after it enables its
own — and forgetting to is a table PostgREST would serve to a leaked anon key. That is the
failure mode here, and it is invisible until it is exploited.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

CLIENT_ROLES = ("anon", "authenticated")


async def test_every_public_table_has_row_level_security_enabled(
    db_session: AsyncSession,
) -> None:
    result = await db_session.execute(
        text(
            "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"
        )
    )

    assert result.scalars().all() == []


async def test_row_level_security_is_not_forced(db_session: AsyncSession) -> None:
    """Deliberately: with no policies, FORCE locks the owner out of its own schema, and the
    owner is the role the migrations run as. ADR-0002 says why at length."""
    result = await db_session.execute(
        text(
            "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity"
        )
    )

    assert result.scalars().all() == []


async def test_no_public_table_carries_a_policy(db_session: AsyncSession) -> None:
    """A policy is how a row reaches a client role, and no client role may reach one."""
    result = await db_session.execute(
        text("select tablename, policyname from pg_policies where schemaname = 'public'")
    )

    assert result.all() == []


async def test_the_client_roles_hold_no_grant_in_the_public_schema(
    db_session: AsyncSession,
) -> None:
    """RLS decides which rows; a grant decides whether the table can be named at all. Both are
    revoked, so a leaked key is refused before any policy question arises."""
    result = await db_session.execute(
        text(
            "select table_name, grantee, privilege_type from information_schema.role_table_grants "
            "where table_schema = 'public' and grantee = any(:roles)"
        ),
        {"roles": list(CLIENT_ROLES)},
    )

    assert result.all() == []
