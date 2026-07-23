# Database contracts (backend ↔ Postgres)

How `services/api` must drive the database. The schema (see `supabase/migrations/`) defends
its *structural* invariants itself; the backend owns the *multi-step / cross-row* logic that
constraints can't express. This document is that division of labour.

Related decisions: root ADR-0001 (backend owns transactions), root ADR-0002 (backend-only
access / RLS deny-by-default), root ADR-0003 (Postgres-table queues), supabase ADR-0001
(identity), supabase ADR-0002 (RAG freshness).

## Connection & roles

- The backend connects with the **service role** (bypasses RLS). It is the *only* data client;
  clients never touch PostgREST (deny-by-default RLS + revoked grants make direct access
  return nothing).
- Every request carries the user's Supabase JWT. The backend **verifies** it and treats
  `sub` as the acting profile id (`= auth.users.id = profiles.id`). All ownership checks the
  DBML expressed as RLS (`auth.uid() = candidate_id`, tenant membership) are now enforced **in
  the backend** using this verified id — the DB no longer does them.
- Triggers still fire for the service role (unlike RLS). So the criteria-lock and the
  enqueue triggers apply to backend writes too.

## Provisioning identity

A `profiles` row must exist before its `candidates`/`recruiters` row, and `account_type` is
fixed at creation (candidate XOR recruiter, enforced by composite FK).

- **Candidate signup**: in one tx → `insert profiles(id=auth.uid(), account_type='candidate',
  full_name, …)` then `insert candidates(id=auth.uid())`. The candidate insert enqueues an
  (empty) re-embed job automatically.
- **Recruiter invite**: `insert profiles(id, account_type='recruiter', …)` then
  `insert recruiters(id, tenant_id, role)`.
- Do **not** rely on an `auth.users` trigger; the flow decides the role, so the backend writes
  both rows.

## Application submission (the core transaction)

Single DB transaction, service role. The DB guarantees structure; the backend must validate
everything below **before** committing.

Backend-enforced preconditions (not expressible as constraints):
1. `cv_id` belongs to `auth.uid()`, `deleted_at IS NULL`, and `parsing_status = 'ready'`.
2. Every `is_required` question of the job is answered, and each answer's type matches
   (`yes_no` → `answer_boolean`, `short_text` → `answer_text`). *(The single-answer-kind CHECK
   and the answer→question FK are DB-enforced; "all required answered" is not.)*
3. Screening criteria are already locked if this is not the job's first application (the DB
   also enforces this via trigger).

DB-enforced on write (rely on these — a backend bug cannot bypass them):
- `applications.(tenant_id, job_id)` → `jobs` (tenant match); `(candidate_id, cv_id)` → `cvs`
  (CV ownership); `UNIQUE(candidate_id, job_id)` (one application per job).
- `application_answers.(job_id, question_id)` → real question of the job; answer-kind CHECK.

Write order in the tx:
```
insert applications(id, tenant_id, candidate_id, job_id, cv_id, tracked_link_id)
insert application_profile_snapshots(...)
insert application_experiences/_educations/_skills/_projects/_languages(...)   -- the reviewed data
insert application_answers(application_id, job_id, question_id, answer_*)
insert application_status_history(application_id, change_source='candidate', new_status='new')
-- then run screening (below), or enqueue it
```
The reviewed data may come from the candidate's live `candidate_*` tables **or** a reviewed
alternate-CV form; the snapshot is source-agnostic and immutable afterward. Optionally, if the
candidate chose "also update my global profile", upsert their `candidate_*` rows in the same
tx (that fires re-embed enqueue).

## Screening (deterministic, no score)

Reads **only** the immutable `application_*` snapshot for the application — never the live
`candidate_*` tables. Rules (all mandatory criteria must pass ⇒ `qualified`):
- required skill absent → `disqualified`; required-skill years < `minimum_years` →
  `disqualified`; unknown years for a required skill → `review_required`.
- total experience < `jobs.minimum_total_experience_years` → `disqualified`; cannot be computed
  → `review_required`.
- required language absent / below `minimum_proficiency` → `disqualified`.
- a `yes_no` knockout answer ≠ `accepted_boolean_answer` → `disqualified`.
- `preferred`/`optional` skills never disqualify.

Persisting a verdict (append-only history + denormalized current):
```
insert application_qualification_history(application_id, qualification_status,
       qualification_reason, screening_version);
update applications set qualification_status = <verdict>, qualification_reason = <why>
  where id = <application_id>;
```

## Workers (Postgres-table queues, SKIP LOCKED)

Generic claim pattern — atomic claim-and-mark, non-blocking across workers:
```sql
update <queue> q set status='processing', started_at=now(), attempts=attempts+1
where q.id = (
  select id from <queue>
  where status='pending' and (available_at is null or available_at <= now())
  order by created_at
  limit 1 for update skip locked
) returning q.*;
```
Backoff on failure: set `status='pending'`, `available_at = now() + backoff(attempts)`,
`error_message`. Give up (or dead-letter) after a max attempts.

### CV ingestion (`ingestion_jobs` → `sync_ingestion`/`sync_parsers`/`sync_worker`)
- One job per CV (enqueued by trigger on `cvs` insert; `cv_id` is UNIQUE).
- Parse, then **write `cvs.parsing_status`** (`processing`→`ready`/`failed`) as the last step —
  `cvs.parsing_status` is authoritative; `ingestion_jobs.status` is internal plumbing readers
  ignore. Store the validated ParsedCv JSON in `cvs.parsed_cv_data`, set `parsed_at`.

### Re-embedding (`candidate_embedding_jobs` → `sync_rag`)
Coalesced, one row per candidate. Claim a dirty row, capture its `revision`, then:
```
1. read the candidate's CURRENT candidate_* profile
2. compute 768-dim embeddings (cosine; model recorded in embedding_model)   -- slow, outside tx
3. in ONE tx:
     delete from candidate_profile_chunks where candidate_id = :cid;         -- atomic swap
     insert into candidate_profile_chunks (...) values ...;
     update candidate_embedding_jobs
       set dirty = (revision <> :claimed_revision), claimed_at = null, error_message = null
       where candidate_id = :cid;
```
If the profile changed while embedding (`revision` advanced), `dirty` stays true → reprocess.
Never patch chunks in place. Search only ever sees a fully-embedded profile.

### Communications (`communications` → sender)
- Also the delivery-audit record. Claim `status='queued'`; resolve the recipient's verified
  email from `auth.users` (never from a snapshot); send via provider using `idempotency_key`;
  set `status`, `provider`, `provider_message_id`, `sent_at`, or retry via `attempts`.
- A recruiter-initiated row requires `application_id` and a same-tenant recruiter (DB CHECK +
  composite FKs enforce the shape; the backend sets them).

## Global candidate search

Discoverability is the `candidate_search_profiles` view (searchable + not deleted + `ready`
current CV + has chunks). Vector search:
```sql
select s.*, ch.chunk_text, (ch.embedding <=> :query_embedding) as distance
from candidate_profile_chunks ch
join candidate_search_profiles s on s.candidate_id = ch.candidate_id
order by ch.embedding <=> :query_embedding
limit :k;
```
Never project email or phone. Never expose another tenant's notes/tags/applications/comms.

## Storage

CV files live in the private `cvs` bucket. The backend issues signed upload/download URLs and
stores the returned object path in `cvs.storage_path`. No client touches Storage directly.

## Invariant ownership summary

| Invariant | Enforced by |
| --- | --- |
| Candidate XOR recruiter; CV/tenant ownership FKs; one application/job; answer↔question; tag scope; date/enum/range CHECKs; criteria lock; partial-unique CV | **Database** |
| Auth (JWT), per-user/tenant authorization, CV `ready` before apply, all required questions answered, screening rules, chunk atomic-swap, queue backoff, verified-email resolution | **Backend** |
