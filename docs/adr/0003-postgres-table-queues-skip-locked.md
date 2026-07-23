# Async work runs on Postgres-table queues (SKIP LOCKED), not pgmq or an external broker

Status: accepted

The three async workloads — CV parsing (`ingestion_jobs`), profile re-embedding
(`candidate_embedding_jobs`), and communications (`communications`) — are backed by typed
Postgres tables. Producers enqueue by `INSERT`/`UPSERT` **inside the same transaction** as
the change that triggered them (via triggers), so no job is ever lost. Consumers (the
Python worker) claim rows with `SELECT ... FOR UPDATE SKIP LOCKED` and retry via
`available_at` + `attempts`; `LISTEN/NOTIFY` wakes workers with low latency, and a periodic
`pg_cron` sweep requeues stuck jobs.

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
- `communications` doubles as the delivery-audit record, not just a transient message.
- This choice is coherent with the trigger-based enqueue (ADR 0002): both depend on the
  enqueue being in-transaction with the data change.
