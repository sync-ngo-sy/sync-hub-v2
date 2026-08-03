# Async work runs on Postgres-table queues (SKIP LOCKED), not pgmq or an external broker

Status: accepted

The three async workloads — CV parsing (`ingestion_jobs`), profile re-embedding
(`candidate_embedding_jobs`), and communications (`communications`) — are backed by typed
Postgres tables. Producers enqueue by `INSERT`/`UPSERT` **inside the same transaction** as
the change that triggered them (via triggers), so no job is ever lost. Consumers (the
Python worker) claim rows with `SELECT ... FOR UPDATE SKIP LOCKED` and retry via
`available_at` + `attempts`; `LISTEN/NOTIFY` wakes workers with low latency, and a periodic
`pg_cron` sweep requeues stuck jobs.

**Amended when the worker became a service.** The consumer no longer polls. It was eleven
concurrent polling tasks in a permanently running process — roughly fifty thousand queries a
day on an idle system, and a container rented around the clock mostly to sleep. It is now an
HTTP service that drains its queues on demand and scales to zero between bursts. Two things
call it: a database webhook on enqueue, for sub-second latency, and a schedule every few
minutes. The endpoints take a shared secret rather than IAM, because neither caller can mint
a Google identity token.

**The schedule is the correctness guarantee, not a fallback.** It performs a drain *as well
as* a sweep, and in that order. The sweep only rescues rows already in a processing state
that a crashed invocation abandoned; it will never see a row still pending. So a dropped
webhook would strand that row forever if the scheduled call swept alone. The webhook is a
latency optimisation and nothing depends on it.

The claim semantics above are what make this safe: `FOR UPDATE SKIP LOCKED` means parallel
invocations cannot double-process, so a burst of webhooks coalesces into whichever instances
happen to be running rather than one per event. Each drain is bounded by a row ceiling, so a
continuously fed queue cannot keep one request alive until the platform kills it mid-job.

## Considered options

- **pgmq / Supabase Queues** — rejected: no message coalescing (the embedding queue needs
  one re-embed per burst and would otherwise need a dirty flag anyway), JSONB payloads
  instead of typed state, and `communications` must stay a durable audit table regardless —
  so it becomes a mixed model.
- **External broker (Redis / SQS)** — rejected: the enqueue can't be transactional with the
  DB write, reintroducing lost jobs unless a Postgres outbox is added (a Postgres queue
  again); extra infrastructure for no MVP benefit.

## Consequences

- The worker owns polling/backoff/visibility, modeled by `available_at` / `attempts` /
  `started_at`.

## Amendment (2026-07-24): poll + in-worker sweep, no LISTEN/NOTIFY or pg_cron yet

The MVP worker polls each queue (~1s, idle backoff) and runs the stuck-job sweep as a
periodic in-worker task, instead of LISTEN/NOTIFY wake-ups and a pg_cron sweep. At current
load, ≤1s pickup latency is indistinguishable from NOTIFY and avoids a dedicated listener
connection, reconnect handling, and pg_cron configuration. LISTEN/NOTIFY remains the
documented optimization path if pickup latency ever matters.
- `communications` doubles as the delivery-audit record, not just a transient message.
- This choice is coherent with the trigger-based enqueue (ADR 0002): both depend on the
  enqueue being in-transaction with the data change.
