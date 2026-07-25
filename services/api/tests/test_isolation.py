"""The harness's own contract: each test starts empty, with reference data intact.

The three tests below are deliberately order-dependent — `test_a_...` writes and
`test_b_...` proves the write is gone. pytest runs a module top to bottom, and there is no
other way to demonstrate that isolation actually happens between tests.
"""

from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import Language, SkillTaxonomy, Tenant


async def test_a_writes_are_committed_and_visible(db_session: AsyncSession) -> None:
    db_session.add(Tenant(name="Acme Recruiting", slug="acme"))
    # Advance the schema's one identity sequence too, so `test_b` can prove it was restarted.
    await db_session.execute(text("select nextval('public.job_view_events_id_seq')"))
    await db_session.commit()

    tenants = (await db_session.execute(select(Tenant.slug))).scalars().all()
    assert list(tenants) == ["acme"]


async def test_b_the_previous_test_left_nothing_behind(db_session: AsyncSession) -> None:
    count = await db_session.scalar(select(func.count()).select_from(Tenant))

    assert count == 0


async def test_b_generated_ids_restart_from_the_beginning(db_session: AsyncSession) -> None:
    """RESTART IDENTITY: no test inherits the id counter `test_a` advanced."""
    result = await db_session.execute(
        text("select sequencename, last_value from pg_sequences where schemaname = 'public'")
    )
    advanced = {name: value for name, value in result if value is not None}

    assert advanced == {}


async def test_reference_data_survives_the_reset(db_session: AsyncSession) -> None:
    """Languages and the Canonical skill taxonomy are schema contract, not test data."""
    languages = await db_session.scalar(select(func.count()).select_from(Language))
    skills = await db_session.scalar(select(func.count()).select_from(SkillTaxonomy))

    assert languages is not None and languages > 0
    assert skills is not None and skills > 0
    assert await db_session.scalar(select(Language.name).where(Language.code == "en")) == "English"


async def test_auth_users_are_cleared_too(db_session: AsyncSession) -> None:
    """GoTrue's users are state as much as ours; a leftover user breaks signup tests."""
    count = await db_session.scalar(text("select count(*) from auth.users"))

    assert count == 0
