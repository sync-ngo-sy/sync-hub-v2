"""The cast, read against the taxonomy it is held to.

The demo seed writes its Candidates and Jobs through the API's own services, so a cast naming a
skill the taxonomy does not have breaks the run partway through, after it has already made three
Tenants and nine Candidates. This reads the cast instead.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from seed.cast import CANDIDATES, JOBS
from sqlalchemy import select

from sync_core.models import SkillTaxonomy

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def test_every_skill_the_cast_names_is_a_canonical_skill(db_session: AsyncSession) -> None:
    named = {skill.name for person in CANDIDATES for skill in person.profile.skills} | {
        skill.name for job in JOBS for skill in job.criteria.skills
    }
    held = set((await db_session.scalars(select(SkillTaxonomy.canonical_name))).all())

    assert named <= held
