from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import Select, func, literal, select, true, union_all

from sync_api.jobs.links import APPLICATION_COUNT, VIEW_COUNT
from sync_api.rates import percentage
from sync_api.stats.payload import (
    ApplicationCounts,
    JobCounts,
    PipelineStatusCounts,
    QualificationCounts,
    Source,
    TenantStats,
)
from sync_api.windows import rolling_since
from sync_core.models import (
    Application,
    ApplicationStatus,
    Job,
    JobStatus,
    JobViewEvent,
    QualificationStatus,
    TrackedJobLink,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter

#: What the Dashboard's card has room for. The rest are counted, not returned.
SOURCES_ON_THE_CARD: Final = 6

#: Views that arrived at a Job without a tracked link — the public board, a shared URL, a search
#: result. Named rather than omitted: without it, tracked links read as all of the traffic.
DIRECT: Final = "Direct"


class StatsService:
    """Everything the Recruiter Dashboard counts, over the whole Tenant.

    Two reads: one that counts rows, and one that ranks the channels they arrived through. Every
    query is scoped by tenant in the query itself.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def counts(self, recruiter: ActingRecruiter) -> TenantStats:
        tenant_id = recruiter.tenant.id
        counted = (await self._db.execute(_counts(tenant_id))).mappings().one()
        sources, channels = await self._sources(tenant_id)

        return TenantStats(
            jobs=JobCounts(
                total=counted["jobs_total"],
                published_last_week=counted["jobs_published_last_week"],
                **{status.value: counted[_job(status)] for status in JobStatus},
            ),
            applications=ApplicationCounts(
                total=counted["applications_total"],
                last_24h=counted["applications_last_24h"],
                last_7d=counted["applications_last_7d"],
                previous_7d=counted["applications_previous_7d"],
                by_status=PipelineStatusCounts(
                    **{status.value: counted[_status(status)] for status in ApplicationStatus}
                ),
                by_qualification=QualificationCounts(
                    **{verdict.value: counted[_verdict(verdict)] for verdict in QualificationStatus}
                ),
                pass_rate=_pass_rate(
                    qualified=counted[_verdict(QualificationStatus.QUALIFIED)],
                    disqualified=counted[_verdict(QualificationStatus.DISQUALIFIED)],
                ),
            ),
            sources=sources,
            sources_total=channels,
        )

    async def _sources(self, tenant_id: UUID) -> tuple[list[Source], int]:
        """The card's six, and how many channels there were to choose them from.

        Both come from one statement: the count is a window over the grouped rows, which
        Postgres computes before the limit clips them.
        """
        rows = (await self._db.execute(_ranked_sources(tenant_id))).tuples().all()
        return (
            [
                Source(
                    name=name,
                    views=int(views),
                    applications=int(applications),
                    conversion_rate=percentage(int(applications), of=int(views)),
                )
                for name, views, applications, _channels in rows
            ],
            rows[0][3] if rows else 0,
        )


def _pass_rate(*, qualified: int, disqualified: int) -> int | None:
    """Over the verdicts Screening actually reached. An Application still pending is not a
    failure, and counting it as the denominator would report a rate that only ever falls."""
    return percentage(qualified, of=qualified + disqualified)


def _job(status: JobStatus) -> str:
    return f"jobs_{status.value}"


def _status(status: ApplicationStatus) -> str:
    return f"status_{status.value}"


def _verdict(status: QualificationStatus) -> str:
    return f"verdict_{status.value}"


def _counts(tenant_id: UUID) -> Select[Any]:
    """Both tables in one statement, each scanned once.

    `count(*) filter (where ...)` rather than a subquery per number: twenty-odd correlated
    subqueries would read the same rows twenty-odd times to answer one page.

    The columns are labelled from the enums themselves, so a status added to the domain is
    counted here without anyone remembering to — and the payload, whose fields are spelled out,
    fails loudly rather than quietly dropping it.
    """
    jobs = (
        select(
            func.count().label("jobs_total"),
            func.count()
            .filter(Job.published_at > rolling_since(7))
            .label("jobs_published_last_week"),
            *(
                func.count().filter(Job.status == status).label(_job(status))
                for status in JobStatus
            ),
        )
        .select_from(Job)
        .where(Job.tenant_id == tenant_id)
        .subquery()
    )
    applications = (
        select(
            func.count().label("applications_total"),
            func.count()
            .filter(Application.applied_at > rolling_since(1))
            .label("applications_last_24h"),
            func.count()
            .filter(Application.applied_at > rolling_since(7))
            .label("applications_last_7d"),
            func.count()
            .filter(
                Application.applied_at > rolling_since(14),
                Application.applied_at <= rolling_since(7),
            )
            .label("applications_previous_7d"),
            *(
                func.count().filter(Application.status == status).label(_status(status))
                for status in ApplicationStatus
            ),
            *(
                func.count()
                .filter(Application.qualification_status == verdict)
                .label(_verdict(verdict))
                for verdict in QualificationStatus
            ),
        )
        .select_from(Application)
        .where(Application.tenant_id == tenant_id)
        .subquery()
    )
    # Each side aggregates to exactly one row, so joining them on nothing in particular yields
    # the one row carrying both. Spelled as a join rather than left to a comma: an unqualified
    # cartesian product is nearly always a bug, and this codebase treats that warning as one.
    return select(jobs, applications).select_from(jobs).join(applications, true())


def _ranked_sources(tenant_id: UUID) -> Select[Any]:
    """Every channel the tenant's Job views arrived through, and what each turned into, busiest
    first.

    Grouped by name rather than by link: a link name is unique per Job, so "LinkedIn post" on
    nine Jobs is nine rows here and one channel to a reader. Each link's two counts are the same
    subqueries the Tracked link surfaces read, so a channel adds up to what its links report
    rather than to a second nearly equal answer.

    A link with no views keeps its row — a Recruiter made it, and a channel that delivered
    nothing is worth knowing. `Direct` is not a row anybody made, so it appears only when traffic
    actually arrived that way.
    """
    named = select(
        TrackedJobLink.name.label("name"),
        VIEW_COUNT.label("views"),
        APPLICATION_COUNT.label("applications"),
    ).where(TrackedJobLink.tenant_id == tenant_id)
    direct_applications = (
        select(func.count())
        .select_from(Application)
        .where(Application.tenant_id == tenant_id, Application.tracked_link_id.is_(None))
        .scalar_subquery()
    )
    direct = (
        select(
            literal(DIRECT).label("name"),
            func.count(JobViewEvent.id).label("views"),
            direct_applications.label("applications"),
        )
        .select_from(JobViewEvent)
        .join(Job, Job.id == JobViewEvent.job_id)
        .where(Job.tenant_id == tenant_id, JobViewEvent.tracked_link_id.is_(None))
        .having(func.count(JobViewEvent.id) > 0)
    )

    # Summed over the union rather than concatenated: a link somebody named "Direct" would
    # otherwise put two rows with one label on the card.
    channels = union_all(named, direct).subquery()
    ranked = (
        select(
            channels.c.name,
            func.sum(channels.c.views).label("views"),
            func.sum(channels.c.applications).label("applications"),
        )
        .group_by(channels.c.name)
        .subquery()
    )
    # Ranked on views alone, never on the rate: two views and one Application is a channel
    # nobody has read yet, and a rate made of that would lead the card over a channel that
    # brought hundreds.
    #
    # The count is a window over the grouped rows, which Postgres computes before the limit
    # clips them — so the six that fit and the number there were to choose from arrive
    # together, and a tenant with two hundred channels still sends six rows.
    return (
        select(
            ranked.c.name,
            ranked.c.views,
            ranked.c.applications,
            func.count().over().label("channels"),
        )
        .order_by(ranked.c.views.desc(), ranked.c.name)
        .limit(SOURCES_ON_THE_CARD)
    )
