from __future__ import annotations

from typing import Final

from sqlalchemy import func, select

from sync_core.models import Application, JobViewEvent, TrackedJobLink

#: What one Tracked link brought, correlated so a page of links carries its counts rather than
#: costing a request per row. Defined once and read by every surface that reports a link, so a
#: Job's tab, the Tracked links page and the Dashboard's Sources add up to each other rather
#: than to three nearly equal answers.
VIEW_COUNT: Final = (
    select(func.count())
    .select_from(JobViewEvent)
    .where(JobViewEvent.tracked_link_id == TrackedJobLink.id)
    .correlate(TrackedJobLink)
    .scalar_subquery()
)

#: Matched on the Job as well as the link, which is what the composite index is ordered by. A
#: link belongs to one Job, so the Job adds nothing to the answer and everything to the plan.
APPLICATION_COUNT: Final = (
    select(func.count())
    .select_from(Application)
    .where(
        Application.job_id == TrackedJobLink.job_id,
        Application.tracked_link_id == TrackedJobLink.id,
    )
    .correlate(TrackedJobLink)
    .scalar_subquery()
)
