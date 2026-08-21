"""Giving the seeded rows a past.

Everything up to here was written by the product's own services, which stamp `now()` — correctly,
because that is when it happened. The result is a platform where nine jobs opened and nineteen
applications arrived in the same four seconds, which answers none of the questions the Dashboard
asks: "received in the last 7 days" is every row, "the previous 7 days" is none of them, and a
month of campaign traffic is one spike.

So this pass moves the rows into the past, in one transaction, with `session_replication_role`
set to `replica` for its duration. That is not a shortcut around a rule — it is the only way to
write `updated_at` at all, because `moddatetime` is a BEFORE UPDATE trigger that would overwrite
every value here with the clock. It also keeps a timestamp edit from enqueueing a re-embed of
every Candidate. The setting is `SET LOCAL`, so it lasts exactly as long as the transaction.

Ordering is kept relationally rather than by arithmetic in Python: a status history is spread
across the span between its own Application's `applied_at` and now, so the hops stay in the
order they happened however the fixtures are edited later.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import bindparam, text, update

from seed import cast
from sync_core import transaction
from sync_core.models import (
    AccessRequest,
    Application,
    ApplicationStatus,
    Candidate,
    Cv,
    Job,
    MessageTemplate,
    Profile,
    Recruiter,
    TalentPoolMember,
    Tenant,
    TenantTag,
    TrackedJobLink,
)
from sync_core.stages import stage_of
from sync_core.telling import TELLING_DELAY

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from seed.world import Seeded

#: The Stage projection as a SQL VALUES list, built from the one place it is defined, so this
#: pass cannot drift from what the platform actually told the Candidate.
STAGE_VALUES: Final = ", ".join(
    f"('{status.value}', '{stage_of(status).value}')" for status in ApplicationStatus
)

#: A message the sender took more than this long ago has been delivered; anything newer is still
#: in the queue, which is the state a Recruiter who has just pressed send actually sees.
DELIVERED_AFTER_DAYS: Final = 2

#: How long a Candidate takes to read a Notification, roughly, when they read it at all.
READ_AFTER_HOURS: Final = 20

#: Notifications newer than this are left unread, so the bell has a count on it.
UNREAD_WITHIN_DAYS: Final = 2

#: Written into `communications.provider` on the messages this pass marks delivered. No provider
#: ever saw them, and a row claiming `resend` would be inventing delivery evidence.
SEEDED_PROVIDER: Final = "seed"

#: The delivery that failed, so the sender's error path has a row to render. Keyed by the
#: Application it belongs to.
A_FAILED_DELIVERY: Final = ("hiba", "devops")

_FAILED_DELIVERY_ERROR: Final = "The recipient's mail server refused the message (550)."


async def backdate(session: AsyncSession, seeded: Seeded) -> None:
    """Move every seeded row to when it should have happened."""
    async with transaction(session):
        # For this transaction only: `moddatetime` would otherwise stamp every `updated_at` here
        # with the clock, and the re-embed trigger would mark every Candidate dirty again.
        await session.execute(text("set local session_replication_role = replica"))

        await _identities(session, seeded)
        await _requests(session, seeded)
        await _postings(session, seeded)
        await _documents(session, seeded)
        await _applications(session, seeded)
        await _derived(session)
        await _records(session, seeded)
        await _deliveries(session, seeded)


# ── The people, and when they arrived ─────────────────────────────────────────────────────


async def _identities(session: AsyncSession, seeded: Seeded) -> None:
    clock = seeded.clock
    candidates = [
        {"row_id": seeded.candidates[person.key], "moment": clock.ago(person.joined_days_ago)}
        for person in cast.CANDIDATES
    ]
    await _stamp(session, Candidate, candidates, "created_at", "updated_at")

    # A Tenant, its founding admin and its team all date from when the Tenant was opened. The
    # request that opened it is the only date the seed states, so it is the one they take.
    opened = {
        tenant.key: clock.ago(_asked_days_ago(tenant.key, tenant.admin.email) - 1)
        for tenant in cast.TENANTS
    }
    await _stamp(
        session,
        Tenant,
        [{"row_id": seeded.tenants[key], "moment": moment} for key, moment in opened.items()],
        "created_at",
    )
    await _stamp(
        session,
        Recruiter,
        [
            {"row_id": seeded.recruiters[person.key], "moment": opened[tenant.key]}
            for tenant in cast.TENANTS
            for person in tenant.everyone
        ],
        "created_at",
    )
    # Every Profile, in one statement: a Candidate's dates from when they signed up, a
    # Recruiter's from when their Tenant opened, and the operator's from before all of them.
    profiles = [
        *candidates,
        *(
            {"row_id": seeded.recruiters[person.key], "moment": opened[tenant.key]}
            for tenant in cast.TENANTS
            for person in tenant.everyone
        ),
    ]
    if seeded.operator is not None:
        profiles.append({"row_id": seeded.operator, "moment": clock.ago(90)})
    await _stamp(session, Profile, profiles, "created_at", "updated_at")


def _asked_days_ago(tenant_key: str, admin_email: str) -> float:
    for asked in cast.ACCESS_REQUESTS:
        if asked.tenant == tenant_key or asked.email == admin_email:
            return asked.created_days_ago
    # A Tenant an operator opened directly, with no request behind it.
    return 30.0


async def _requests(session: AsyncSession, seeded: Seeded) -> None:
    """The queue's own dates. A decided request also records when it was decided."""
    clock = seeded.clock
    for asked in cast.ACCESS_REQUESTS:
        asked_at = clock.ago(asked.created_days_ago)
        values: dict[str, Any] = {"created_at": asked_at}
        if asked.outcome != "pending":
            values["decided_at"] = clock.after(asked_at, hours=26)
        await session.execute(
            update(AccessRequest).where(AccessRequest.email == asked.email.lower()).values(**values)
        )


# ── Jobs, links and the traffic that found them ───────────────────────────────────────────


async def _postings(session: AsyncSession, seeded: Seeded) -> None:
    clock = seeded.clock
    for posting in cast.JOBS:
        drafted = clock.ago(posting.created_days_ago)
        values: dict[str, Any] = {"created_at": drafted, "updated_at": drafted}
        if posting.published_days_ago is not None:
            # The column the Dashboard's "opened this week" reads, and the reason a Job that is
            # closed today still counts as having gone live in March.
            values["published_at"] = clock.ago(posting.published_days_ago)
            values["updated_at"] = clock.ago(posting.published_days_ago)
        await session.execute(
            update(Job).where(Job.id == seeded.jobs[posting.key]).values(**values)
        )

    await _stamp(
        session,
        TrackedJobLink,
        [
            {"row_id": seeded.links[link.key], "moment": clock.ago(link.created_days_ago)}
            for posting in cast.JOBS
            for link in posting.links
        ],
        "created_at",
    )


# ── CVs, and the queue rows that read them ────────────────────────────────────────────────


async def _documents(session: AsyncSession, seeded: Seeded) -> None:
    clock = seeded.clock
    uploaded = [
        {
            "row_id": seeded.cvs[person.key, entry.display_name],
            "moment": clock.ago(entry.created_days_ago),
        }
        for person in cast.CANDIDATES
        for entry in person.cvs
    ]
    if not uploaded:
        return
    await _stamp(session, Cv, uploaded, "created_at")

    # A parse finished a few minutes after the upload, and a soft delete came later still.
    await session.execute(
        text(
            "update cvs set parsed_at = created_at + interval '4 minutes' "
            "where parsed_at is not null and id = any(:ids)"
        ).bindparams(ids=[row["row_id"] for row in uploaded])
    )
    await session.execute(
        text(
            "update cvs set deleted_at = created_at + interval '9 days' "
            "where deleted_at is not null and id = any(:ids)"
        ).bindparams(ids=[row["row_id"] for row in uploaded])
    )
    # The queue row the upload trigger opened, settled when the parse settled.
    await session.execute(
        text(
            "update ingestion_jobs j set created_at = c.created_at, "
            "started_at = c.created_at + interval '30 seconds', "
            "completed_at = c.created_at + interval '4 minutes' "
            "from cvs c where c.id = j.cv_id and c.id = any(:ids)"
        ).bindparams(ids=[row["row_id"] for row in uploaded])
    )


# ── Applications and everything hanging off them ──────────────────────────────────────────


async def _applications(session: AsyncSession, seeded: Seeded) -> None:
    clock = seeded.clock
    await _stamp(
        session,
        Application,
        [
            {
                "row_id": seeded.applications[applied.candidate, applied.job],
                "moment": clock.ago(applied.applied_days_ago),
            }
            for applied in cast.APPLICATIONS
        ],
        "applied_at",
    )
    # `updated_at` is when it last moved, which the history pass below settles. Until then it is
    # the moment it arrived.
    await session.execute(text("update applications set updated_at = applied_at"))


async def _derived(session: AsyncSession) -> None:
    """Everything an Application caused, moved to sit inside its own life.

    Written as SQL against the Application it belongs to rather than as dates computed here: the
    Snapshot was captured when the Application was created, the verdict was reached in the same
    transaction, and each hop of the pipeline came somewhere between then and now — in order.
    """
    await session.execute(
        text(
            "update application_profile_snapshots s set captured_at = a.applied_at "
            "from applications a where a.id = s.application_id"
        )
    )
    await session.execute(
        text(
            "update application_qualification_history h set created_at = a.applied_at "
            "from applications a where a.id = h.application_id"
        )
    )
    await session.execute(
        text(
            "update application_answers n set created_at = a.applied_at "
            "from applications a where a.id = n.application_id"
        )
    )

    # Each hop lands at an even share of the span between the Application arriving and now, so
    # `new` is at the moment it arrived and the last move is the most recent thing that happened.
    await session.execute(
        text("""
            with ordered as (
              select h.id,
                     a.applied_at,
                     row_number() over (partition by h.application_id
                                        order by h.created_at, h.id) - 1 as hop,
                     count(*) over (partition by h.application_id) as hops
              from application_status_history h
              join applications a on a.id = h.application_id
            )
            update application_status_history h
               set created_at = o.applied_at
                     + (now() - o.applied_at) * (o.hop::numeric / greatest(o.hops, 1))
              from ordered o
             where o.id = h.id
        """)
    )
    # An Application's own `updated_at` is when it last moved.
    await session.execute(
        text(
            "update applications a set updated_at = greatest(a.applied_at, m.moved_at) "
            "from (select application_id, max(created_at) as moved_at "
            "      from application_status_history group by application_id) m "
            "where m.application_id = a.id"
        )
    )
    # The reading lands while the Application is still arriving. There is only ever one, so
    # there is nothing to rank.
    await session.execute(
        text(
            "update application_ai_match_assessments m "
            "   set created_at = a.applied_at + interval '90 seconds', "
            "       updated_at = a.applied_at + interval '90 seconds' "
            "  from applications a where a.id = m.application_id"
        )
    )
    # The queue row the arrival trigger opened, settled when the automatic reading landed.
    await session.execute(
        text(
            "update match_assessment_jobs j set created_at = a.applied_at, "
            "started_at = a.applied_at + interval '20 seconds', "
            "completed_at = a.applied_at + interval '90 seconds' "
            "from applications a where a.id = j.application_id"
        )
    )
    # A Notification was written by the move it announces, so it takes that move's moment. The
    # two are paired on the Stages they name rather than by counting moves, because not every
    # move that changed the Stage still has its Notification: a rejection taken back inside
    # its three days took the unread one with it, and counting would then shift every later
    # Notification onto an earlier move. The projection comes from `sync_core.stages` rather
    # than being spelled again in SQL.
    await session.execute(
        text(f"""
            with stages (status, stage) as (values {STAGE_VALUES}),
            heard as (
              select h.application_id, h.created_at,
                     left_behind.stage as came_from, reached.stage as went_to,
                     row_number() over (partition by h.application_id,
                                                     left_behind.stage, reached.stage
                                        order by h.created_at, h.id) as hop_index
              from application_status_history h
              join stages reached on reached.status = h.new_status::text
              join stages left_behind on left_behind.status = h.previous_status::text
              where reached.stage <> left_behind.stage
            ),
            told as (
              select n.id, n.application_id,
                     n.payload ->> 'previous_stage' as came_from,
                     n.payload ->> 'stage' as went_to,
                     row_number() over (partition by n.application_id,
                                                     n.payload ->> 'previous_stage',
                                                     n.payload ->> 'stage'
                                        order by n.created_at, n.id) as told_index
              from notifications n
              where n.type = 'application_stage_changed'
            )
            update notifications n
               set created_at = heard.created_at
              from told
              join heard on heard.application_id = told.application_id
                        and heard.came_from = told.came_from
                        and heard.went_to = told.went_to
                        and heard.hop_index = told.told_index
             where n.id = told.id
        """)
    )
    # A CV notification is told when the read finished, one way or the other.
    await session.execute(
        text(
            "update notifications n set created_at = c.created_at + interval '4 minutes' "
            "from cvs c where n.type in ('cv_parse_failed', 'cv_parse_succeeded') "
            "and (n.payload ->> 'cv_id')::uuid = c.id"
        )
    )
    # The Telling follows the rejection it belongs to, three days behind it. Both the
    # Application's own and the bell's, because they are one moment: the seed's rejections
    # were taken weeks ago, and a Telling left at three days from the reseed would leave a
    # Candidate reading In review for a decision the demo says was taken a fortnight back.
    await session.execute(
        text(
            "update applications a set told_at = decided.at + :delay "
            "from (select application_id, max(created_at) as at "
            "        from application_status_history where new_status = 'rejected' "
            "       group by application_id) decided "
            "where decided.application_id = a.id"
        ).bindparams(delay=TELLING_DELAY)
    )
    await session.execute(
        text(
            "update notifications set visible_at = created_at + :delay "
            "where visible_at is not null"
        ).bindparams(delay=TELLING_DELAY)
    )
    # Read, unless it is recent enough that not having got to it yet is believable. A held
    # Notification is read from its Telling rather than from when it was written, which is the
    # only moment the Candidate could have read it. The CV parse failure stays unread whatever
    # its age: it is the one notification that asks the Candidate to do something, and they
    # have not done it — they still hold no CV.
    await session.execute(
        text(
            "update notifications "
            "   set read_at = coalesce(visible_at, created_at) + make_interval(hours => :hours) "
            " where coalesce(visible_at, created_at) < now() - make_interval(days => :days) "
            "   and type <> 'cv_parse_failed'"
        ).bindparams(hours=READ_AFTER_HOURS, days=UNREAD_WITHIN_DAYS)
    )


# ── What each Tenant filed ────────────────────────────────────────────────────────────────


async def _records(session: AsyncSession, seeded: Seeded) -> None:
    clock = seeded.clock
    await _stamp(
        session,
        TenantTag,
        [
            {"row_id": seeded.tags[tag.tenant, tag.name], "moment": clock.ago(46)}
            for tag in cast.TAGS
        ],
        "created_at",
    )
    await _stamp(
        session,
        MessageTemplate,
        [
            {
                "row_id": seeded.templates[template.tenant, template.name],
                "moment": clock.ago(template.created_days_ago),
            }
            for template in cast.TEMPLATES
        ],
        "created_at",
        "updated_at",
    )
    pooled = [
        {
            "row_id": seeded.candidates[record.candidate],
            "tenant": seeded.tenants[record.tenant],
            "moment": clock.ago(record.pooled_days_ago),
        }
        for record in cast.CANDIDATE_RECORDS
        if record.pooled
    ]
    if pooled:
        # `Any`, because the mapped class's `__table__` is typed as the loosest thing it could
        # be and `update()` wants the narrowest. It is a Table.
        pool: Any = TalentPoolMember.__table__
        await session.execute(
            update(pool)
            .where(
                pool.c.candidate_id == bindparam("row_id"),
                pool.c.tenant_id == bindparam("tenant"),
            )
            .values(added_at=bindparam("moment")),
            pooled,
        )

    # A note about an Application was written while it was being read; one about a Candidate,
    # around when the Tenant filed them. Both are spread so a list has an order to page in.
    await session.execute(
        text("""
            with ordered as (
              select n.id,
                     a.applied_at,
                     row_number() over (partition by n.application_id order by n.created_at, n.id)
                       as written,
                     count(*) over (partition by n.application_id) as notes
              from notes n
              join applications a on a.id = n.application_id
            )
            update notes n
               set created_at = o.applied_at
                     + (now() - o.applied_at) * (o.written::numeric / (o.notes + 1)),
                   updated_at = o.applied_at
                     + (now() - o.applied_at) * (o.written::numeric / (o.notes + 1))
              from ordered o
             where o.id = n.id
        """)
    )
    await session.execute(
        text("""
            with ordered as (
              select n.id,
                     row_number() over (partition by n.tenant_id, n.candidate_id
                                        order by n.created_at, n.id) as written
              from notes n
              where n.candidate_id is not null
            )
            update notes n
               set created_at = now() - make_interval(days => 18 - o.written::int * 3),
                   updated_at = now() - make_interval(days => 18 - o.written::int * 3)
              from ordered o
             where o.id = n.id
        """)
    )
    # A Tag was put on while the thing it is on was being worked.
    await session.execute(
        text(
            "update application_tag_assignments t "
            "   set created_at = a.applied_at + (now() - a.applied_at) * 0.4 "
            "  from applications a where a.id = t.application_id"
        )
    )
    await session.execute(
        text("update candidate_tag_assignments set created_at = now() - interval '15 days'")
    )


# ── Delivery ──────────────────────────────────────────────────────────────────────────────


async def _deliveries(session: AsyncSession, seeded: Seeded) -> None:
    """When each Communication was queued, and what became of it.

    A Communication is queued in the same transaction as the thing it announces, so its date is
    that thing's. What the sender then did with it is the seed's own decision: anything the
    sender could have taken more than two days ago is delivered, anything newer is still queued
    — which is what a Recruiter who has just pressed send is looking at — and one is left
    failed, so the error path has a row. A rejection is the sender's only from its Telling, so
    that, and not when it was queued, is the moment each of those two reads.

    A rejection the Tenant took back is left cancelled where the run left it, since what became
    of it was decided by the reopen rather than by any sender.

    No provider ever saw these. `provider` says `seed` rather than `resend` for that reason.
    """
    await session.execute(
        text(
            "update communications c set created_at = a.applied_at "
            "from applications a "
            "where a.id = c.application_id and c.communication_type = 'application_confirmation'"
        )
    )
    # A rejection was queued by the move that decided it, which its idempotency key names — so a
    # second rejection takes its own moment rather than both taking the last one's.
    await session.execute(
        text("""
            update communications c
               set created_at = h.created_at,
                   available_at = h.created_at + :delay
              from application_status_history h
             where c.communication_type = 'application_rejection'
               and c.idempotency_key = 'application-rejection:' || h.id::text
        """).bindparams(delay=TELLING_DELAY)
    )
    await session.execute(
        text(
            "update communications c "
            "   set created_at = a.applied_at + (now() - a.applied_at) * 0.55 "
            "  from applications a "
            " where a.id = c.application_id and c.communication_type = 'recruiter_message'"
        )
    )
    # A cancelled rejection stopped being live at the move that took it back, which is the
    # first thing that happened to the Application after it was queued.
    await session.execute(
        text("""
            update communications c
               set completed_at = (select min(h.created_at)
                                     from application_status_history h
                                    where h.application_id = c.application_id
                                      and h.created_at > c.created_at)
             where c.status = 'cancelled'
        """)
    )

    failed_for = seeded.applications.get(A_FAILED_DELIVERY)
    await session.execute(
        text(
            "update communications set status = 'sent', attempts = 1, provider = :provider, "
            "sent_at = coalesce(available_at, created_at) + interval '90 seconds', "
            "completed_at = coalesce(available_at, created_at) + interval '90 seconds', "
            "available_at = null "
            "where status <> 'cancelled' "
            "and coalesce(available_at, created_at) < now() - make_interval(days => :days)"
        ).bindparams(provider=SEEDED_PROVIDER, days=DELIVERED_AFTER_DAYS)
    )
    await session.execute(
        text(
            "update communications set status = 'queued', attempts = 0, provider = null, "
            "sent_at = null, completed_at = null, "
            "available_at = case when communication_type = 'application_rejection' "
            "                    then available_at else created_at end "
            "where status <> 'cancelled' "
            "and coalesce(available_at, created_at) >= now() - make_interval(days => :days)"
        ).bindparams(days=DELIVERED_AFTER_DAYS)
    )
    if failed_for is not None:
        await session.execute(
            text(
                "update communications set status = 'failed', attempts = 3, "
                "error_message = :error, provider = :provider, sent_at = null, "
                "completed_at = created_at + interval '11 minutes', available_at = null "
                "where application_id = :application_id "
                "and communication_type = 'application_rejection'"
            ).bindparams(
                error=_FAILED_DELIVERY_ERROR,
                provider=SEEDED_PROVIDER,
                application_id=failed_for,
            )
        )


# ── The one helper the whole pass is built on ─────────────────────────────────────────────


async def _stamp(
    session: AsyncSession,
    entity: Any,
    rows: list[dict[str, Any]],
    *columns: str,
) -> None:
    """Set one or more timestamp columns per row, in a single round trip.

    `row_id` rather than `id` as the parameter name: a bind parameter that shares a column's
    name is the column in a SET clause, and the update would assign the key to itself.
    """
    if not rows:
        return
    # Against the Core table rather than the mapped class: given a list of parameter sets, the
    # ORM reads an UPDATE as its own bulk-update-by-primary-key and wants `id` in every dict,
    # which would then collide with the `id` in the WHERE clause. Core just sends the statement.
    table = entity.__table__
    await session.execute(
        update(table)
        .where(table.c.id == bindparam("row_id"))
        .values(**{column: bindparam("moment") for column in columns}),
        rows,
    )
