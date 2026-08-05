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
    result = await db_session.execute(
        text(
            "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity"
        )
    )

    assert result.scalars().all() == []


async def test_no_public_table_carries_a_policy(db_session: AsyncSession) -> None:
    result = await db_session.execute(
        text("select tablename, policyname from pg_policies where schemaname = 'public'")
    )

    assert result.all() == []


async def test_the_client_roles_hold_no_grant_in_the_public_schema(
    db_session: AsyncSession,
) -> None:
    result = await db_session.execute(
        text(
            "select table_name, grantee, privilege_type from information_schema.role_table_grants "
            "where table_schema = 'public' and grantee = any(:roles)"
        ),
        {"roles": list(CLIENT_ROLES)},
    )

    assert result.all() == []
