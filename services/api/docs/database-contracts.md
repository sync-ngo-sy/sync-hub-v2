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
  (empty) re-embed job automatically. No transaction spans GoTrue and Postgres, so the
  identity is created first and **deleted again** if the tx (or the confirmation email)
  fails — `profiles.id → auth.users(id) ON DELETE CASCADE` makes that one call undo
  everything, leaving the address free to sign up again.
- **Recruiter invite**: `insert profiles(id, account_type='recruiter', …)` then
  `insert recruiters(id, tenant_id, role)`.
- Do **not** rely on an `auth.users` trigger; the flow decides the role, so the backend writes
  both rows.

## Candidate profile replacement

`PUT /v1/candidates/me/profile` replaces the live profile whole, in one transaction, service
role. The candidate row is locked `FOR UPDATE` and updated, and every `candidate_*` child row
is deleted and re-inserted — never matched up and patched — so no reader ever sees a
half-saved profile and `sort_order` is simply the position each entry had in the request. The
lock is what makes concurrent saves last-write-wins: without it each transaction deletes only
what the other has already committed, and both sets of inserts survive.

Backend-enforced preconditions (all checked **before** anything is written, so a refusal
cannot leave a section emptied):
1. Every skill names an existing `skill_taxonomy.canonical_name`, exactly; every language
   code (including `candidates.preferred_language_code`) exists in `languages`. Both refuse
   with problem+json naming the offending entries rather than letting the FK do it.
2. `is_searchable` only goes true when `candidates.current_cv_id` names a CV that is
   `parsing_status = 'ready'` and not soft-deleted. The `candidates_searchable_needs_cv`
   CHECK covers only the first half — the CV's state is a second row, so migration 02 leaves
   it here — and the whole condition is answered as a 409, not a write failure.
3. The date, month, year and one-entry-per-skill rules the `candidate_*` CHECKs enforce are
   restated in the request model, so a bad shape is a located 422 and never reaches Postgres.

The re-embed queue looks after itself: every one of those writes fires
`enqueue_candidate_reembed`, which upserts the candidate's single `candidate_embedding_jobs`
row, so any number of successive saves leaves exactly one dirty job with a bumped `revision`.

## Jobs: the criteria lock, and what the public may read

A Job's *criteria* — `job_skills`, `job_languages`, `job_application_questions` and
`jobs.minimum_total_experience_years` — are one thing that freezes together, so
`PUT /v1/tenants/me/jobs/{id}/criteria` replaces all four at once, deleting and re-inserting
the child rows rather than matching them up. The prose (`title`, `description`, `location`,
`employment_type`, `expires_at`) and the lifecycle move through a separate `PATCH`, which is
why a typo can still be fixed after the applications start arriving.

The lock itself is the database's: `forbid_locked_job_criteria` and
`forbid_locked_job_min_experience` fire for the service role like any other trigger. The
backend checks for an Application *before* writing anyway, so the recruiter gets a 409
naming what is frozen instead of a constraint message — and repeats the check when the
trigger refuses the write regardless, because an Application can land between the two.
Emptying already-empty criteria fires no row trigger at all, which is the other reason the
backend has to know the answer itself.

`status` is a light state machine the backend owns (`job_status` is only an enum): a draft
publishes or is archived, a published Job closes or is archived, a closed Job reopens, and
an archived Job is finished. Anything else is a 409 rather than a silent write.

Public browse and read (`GET /v1/jobs`, `/v1/jobs/{id}`, `/v1/jobs/by-link/{token}`) are the
only endpoints with no session behind them, so they carry their own rate limit and their own
`where` clause: `status = 'published'`, the owning `tenants.is_active`, and `expires_at`
either unset or still ahead — the pair `jobs_status_expires_at_idx` indexes. `q` is a hard
filter over `jobs.search_vector` (`websearch_to_tsquery`), never a ranking: the newest Job is
always first. A public payload never carries `accepted_boolean_answer`; which answer passes a
knockout question is the Job's business, not the applicant's.

Reading one Job writes a `job_view_events` row — through a tracked link, with that link's id
in it. The `session_id` is the platform's own `sync_visitor` cookie (issued on the first
read, so it says "the same browser came back" and nothing else) and `visitor_hash` is a
salted SHA-256 of address and user agent, so the analytics table cannot be walked back to the
people in it. A `tracked_job_links` row that is inactive, past its `expires_at`, or points at
a Job the public cannot see resolves to the same 404 as a token that was never issued.

## Application submission (the core transaction)

Single DB transaction, service role. The DB guarantees structure; the backend must validate
everything below **before** committing.

Backend-enforced preconditions (not expressible as constraints). All of these are answered
**before** the transaction opens, so the common refusals never even begin an Application; the
one that cannot be (the searchable opt-in below, which needs the candidate row locked) runs
inside it and takes the whole submission back with it:
1. The Job is one the public may read — `public_jobs()`, the same predicate browse uses. A Job
   nobody can read is a Job nobody can apply to, and both answer the same 404.
2. `cv_id` belongs to the acting candidate and `deleted_at IS NULL` (404), and
   `parsing_status = 'ready'` (409 — a CV still being read is not a refusal of the CV).
3. Every `is_required` question of the job is answered, and each answer's type matches
   (`yes_no` → `answer_boolean`, `short_text` → `answer_text`). *(The single-answer-kind CHECK
   and the answer→question FK are DB-enforced; "all required answered" is not.)* One 422 names
   every offending entry — unanswered, mistyped, or asked by some other Job.
4. Every skill of the reviewed data is a Canonical skill and every language code is known —
   `sync_api.vocabulary`, as the profile `PUT` uses it, located at `body.profile.…`.
5. The candidate has not applied to this Job already: 409 carrying `application_id`. Withdrawal
   permanence falls out of the same rule — a withdrawn Application still holds its job, because
   `UNIQUE(candidate_id, job_id)` does not care what state it is in.

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
-- then run screening (below) synchronously, inside this same transaction —
-- an application is never observable without its verdict
insert communications(...)                      -- the confirmation, status='queued'
-- and, if asked for, the live-profile replacement
```
The reviewed data may come from the candidate's live `candidate_*` tables **or** a reviewed
alternate-CV form; the snapshot is source-agnostic and immutable afterward. `full_name` and
`phone` are not part of it: they are the candidate's identity, read off `profiles` rather than
retyped per application. Optionally, if the candidate chose "also update my global profile",
their `candidate_*` rows are replaced in the same tx by the same
`candidates.replace_live_profile` the profile `PUT` calls — which is why the re-embed trigger
coalesces the whole submission into the candidate's single dirty job, and why a refusal it
raises (opting in to Global search without a ready CV) rolls the Application back with it.

The confirmation Communication is written here rather than by a producer of its own, for the
reason a Notification is: a candidate is never told about an Application the transaction then
rolled back. `recipient` is the verified address as it stood; the sender resolves it again
from `auth.users` before it delivers. `idempotency_key` is
`application-confirmation:{application_id}`, so the row is one per Application by construction.

`tracked_link_id` is attribution, and it comes from the **landing context, not the request**:
the newest `job_view_events` row for this Job with this browser's `sync_visitor` session and a
`tracked_link_id` on it. A Candidate who arrived through a campaign link keeps carrying it
through signup and into the submission; one who found the Job themselves carries nothing. The
applicant cannot name a link, so attribution says which channel actually did the work. A link
turned off between the view and the submission still gets the credit: it brought them.

## Screening (deterministic, no score)

Reads **only** the immutable `application_*` snapshot for the application — never the live
`candidate_*` tables. Rules (all mandatory criteria must pass ⇒ `qualified`):
- required skill absent → `disqualified`; required-skill years < `minimum_years` →
  `disqualified`; unknown years for a required skill → `review_required`.
- total experience < `jobs.minimum_total_experience_years` → `disqualified`; cannot be computed
  → `review_required`.
- required language absent / below `minimum_proficiency` → `disqualified`.
- a `yes_no` knockout answer ≠ `accepted_boolean_answer` → `disqualified`; a knockout question
  left unanswered → `review_required` (only reachable where the Recruiter made a knockout
  question optional: a bar nobody has been shown to clear, not one they failed).
- `preferred`/`optional` skills never disqualify.

Total experience is the *merged* span of the dated Snapshot experiences — two jobs at once is
one year a year, not two — with a `is_current` job running to today. Undated work only matters
where it could have carried the applicant over the bar: measured work that already clears the
minimum is `qualified` regardless, and only a shortfall with something undated in it is
`review_required` rather than `disqualified`. A rule that fails outright outranks one that
merely cannot be answered, so any `disqualified` finding decides the verdict.

Persisting a verdict (append-only history + denormalized current):
```
insert application_qualification_history(application_id, qualification_status,
       qualification_reason, screening_version);
update applications set qualification_status = <verdict>, qualification_reason = <why>
  where id = <application_id>;
```

## Application review (pipeline states)

Reading is tenant-scoped in the query itself — the applicant list through the Job, the review
through `applications.tenant_id` — so another tenant's Application and a nonexistent one are
the same 404. A review reads the immutable `application_*` snapshot, the answers joined to the
questions that were asked, `application_status_history` oldest first, and a short-lived signed
Storage URL for the CV the Application was sent with.

Moving is a light state machine (`sync_api.applications.pipeline`), and it is the backend's
alone — no constraint or trigger knows about it:
- A Recruiter moves freely among `new`, `reviewing`, `shortlisted`, `interview` and `offer`,
  and from any of them to `hired` or `rejected`. Backwards included: a tracker that only went
  forwards would not match how hiring goes.
- `hired` and `withdrawn` are final. `rejected` is final except back to `reviewing`, which is
  the undo for a decision made on the wrong row.
- `withdrawn` is the Candidate's own move, from any undecided state, and irreversible. A
  Recruiter asking for it is refused, as is a move to the state the Application is already in.
- Everything not spelled out is a 409 `application-transition-not-allowed`.

Every accepted move, in one transaction:
```
update applications set status = :to            -- `updated_at` is the trigger's to write
insert application_status_history(application_id, change_source, changed_by_profile_id,
       previous_status, new_status)
insert notifications(...)          -- `application_status_changed`, to the applicant
insert communications(...)         -- only a Recruiter's `rejected`, status='queued'
```
The verdict is not part of it: `qualification_status`, `qualification_reason` and
`application_qualification_history` belong to Screening, and moving an Application through the
pipeline is not a re-screening. The rejection's `idempotency_key` is
`application-rejection:{status_history_id}` rather than the Application's id — undoing a
rejection and deciding it again is a second decision, and the Candidate hears about both.
`initiated_by_recruiter_id` names the human who decided it, which is also what makes the row a
recruiter-initiated one under the table's CHECKs.

Withdrawal permanence is the schema's rather than the backend's: `UNIQUE(candidate_id, job_id)`
does not care what state the row is in, so re-applying meets the same 409 carrying the existing
`application_id` that any duplicate does.

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

A claim, the work, and the outcome are **three transactions, not one** (`sync_worker.engine`).
The claim commits immediately so the row is visibly `processing`; the slow work holds no
transaction at all; the consumer's own writes are committed *with* the job's completion, so a
finished job and the state it produced can never disagree. A consumer that knows its failure
is settled raises `PermanentFailureError` and dies on the spot rather than spending the rest
of its attempts confirming it. The sweep requeues a stuck `processing` row, or buries it when
its attempts are already gone — otherwise a worker that died on its last attempt would leave
the row, and whatever waits on it, stuck for good.

### CV ingestion (`ingestion_jobs` → `sync_ingestion`/`sync_parsers`/`sync_worker`)
- One job per CV (enqueued by trigger on `cvs` insert; `cv_id` is UNIQUE).
- Parse, then **write `cvs.parsing_status`** (`processing`→`ready`/`failed`) as the last step —
  `cvs.parsing_status` is authoritative; `ingestion_jobs.status` is internal plumbing readers
  ignore. Store the validated ParsedCv JSON in `cvs.parsed_cv_data`, set `parsed_at`.
- `failed` is written **only when the job is dead for good**, never between retries: a CV that
  flickered to `failed` would tell a candidate their upload was rejected while the platform was
  still trying. `store` and `fail` are the consumer's `record`/`give_up`, so each is committed
  in the same transaction as the job outcome that caused it.
- Returned skills are re-validated against `skill_taxonomy` (case-insensitively, answering in
  the canonical spelling); anything unmatched moves to the parse's `unmapped_skills`, which the
  candidate reviews and Screening never reads. Unknown language codes are dropped, and every
  other field is coerced to the limits in `sync_core.profile` — the review screen posts the
  parse back to `PUT /v1/candidates/me/profile`, so a parse it would refuse is unusable.
- The candidate's **first** `ready` CV sets `candidates.current_cv_id` if it is still unset, with
  the candidate row locked `FOR UPDATE`. Only the first: after that it is the candidate's choice.
- A dead job also inserts the candidate's `cv_parse_failed` **Notification**, in `give_up`'s own
  transaction (see Notifications below) — so the progress indicator never ends in silence, and
  no candidate is told about a failure the transaction then rolled back. If the `cvs` row has
  been deleted meanwhile there is nothing to fail and nobody to tell, and the consumer says so
  in the log rather than writing a notification whose recipient it cannot name.

### Re-embedding (`candidate_embedding_jobs` → `sync_rag`/`sync_worker`)
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

This queue is shaped unlike the others, so `sync_worker.embedding` drives it rather than the
generic engine: there is no status column and no `available_at`. `claimed_at` is the claim
(NULL = nobody holds it, and the sweep releases one held past the stuck threshold), and
`updated_at` is the earliest time to try again — the enqueue trigger sets it to `now()`, a
failure sets it to `now() + backoff(attempts)`. There is also no dead state: a job that keeps
failing keeps its `dirty` (which is simply true — the chunks *are* out of date) and is retried
on an interval that stops doubling at about an hour. A success resets `attempts` to zero.

Chunking is per section, from the live tables: one `identity` chunk, one per `experience` and
per `project`, and one each for `education`, `skills` and `languages`. `chunk_type` records
which, and `chunk_text` is what a recruiter is shown as the evidence for a hit. An empty
section produces no chunk, so a profile with nothing in it produces nothing to find.

### Communications (`communications` → `sync_comms`/`sync_worker`)
- The queue row *is* the delivery-audit record, so it carries both: `communication_status`
  spells the generic engine's four states (`queued`/`processing`/`sent`/`failed`) and
  migration 13 added the three timestamps the claim, the backoff and the sweep need.
  `completed_at` is when the queue let go of the row either way; `sent_at` only ever means a
  provider accepted the message.
- Claim `status='queued'` **and `channel='email'`**: one table will hold more than one
  channel, and a row the email sender cannot deliver has to keep waiting for its own sender
  rather than be claimed and buried.
- Resolve the recipient's verified email from `auth.users` — never
  from a Snapshot and never from the row's own `recipient`, which is only what the address
  was when the message was queued. No confirmed email is a permanent failure, not a retry.
- Render `template_key` (a backend-owned template, versioned, written at enqueue time) and
  send through the `EmailSender` port, passing `idempotency_key` to the provider. That key is
  what stops a re-claimed row — one whose worker died after the provider took the message —
  from reaching the candidate twice.
- `record` writes `recipient`, `subject`, `provider`, `provider_message_id` and `sent_at` in
  the same transaction that marks the row `sent`, so evidence and status cannot disagree.
- A recruiter-initiated row requires `application_id` and a same-tenant recruiter (DB CHECK +
  composite FKs enforce the shape; the backend sets them).

## Notifications (written in the triggering transaction, no queue)

An in-app message to one Profile, with a typed payload and a read/unread state. Distinct from a
Communication: never delivered externally, never queued, and never sent by a worker of its own.

- **Who writes one**: whatever transaction the notification announces, through
  `sync_core.notifications.notify(session, recipient_profile_id, payload)`, which flushes and
  leaves the commit to its caller. There are two producers: a permanent CV parse failure, and
  every Application status change. There is no endpoint that creates one — the only client
  write on this surface is the recipient marking one read.
- **Payloads** are a Pydantic discriminated union on the mandatory `type`, spelled once in
  `sync_core.notifications` and exposed through OpenAPI so the SPA narrows on that one field.
  They carry ids and names, never prose: English belongs to the frontend, which keeps a future
  translation out of the database. Adding a type is a `notification_type` value (migration), a
  model, a member of the union, and the producer that writes it — in one change, so no
  deployed reader can meet a type it has never heard of.
- `application_id` is filled from the payload rather than passed alongside it, so the queryable
  column and the rendered payload cannot name different Applications. A `cv_parse_failed`
  notification is about no Application and leaves it null.
- **DB-enforced on write** (rely on these): `payload ->> 'type' = type::text`, so the queryable
  column and the rendered payload cannot disagree; and the composite FK
  `(application_id, recipient_profile_id) → applications (id, candidate_id)`, so a notification
  about an Application can only be addressed to the Candidate who applied. `notify` fills both
  the column and the payload from one object, so a producer cannot get them out of step in the
  first place — the constraints are there for the producer that tries.
- **Reading** is scoped by `recipient_profile_id` *in the query*, never checked afterwards:
  somebody else's notification and a nonexistent one must be the same 404. The list is keyset-
  paginated on `(created_at desc, id desc)` — the ordering
  `notifications_recipient_created_idx` provides — and the unread count is a `count(*)` over
  the partial `read_at is null` index rather than a read of the list.
- **Marking read** is idempotent and keeps the first `read_at`: the SPA marks on render, so the
  same notification is marked every time the list is opened, and moving the timestamp forward
  each time would make it a "last seen" field under a name that promises the first.
- `ON DELETE CASCADE` on `recipient_profile_id` covers a Profile row genuinely going away —
  which is the signup-rollback path, not account deletion. Account deletion *bans* the GoTrue
  user and soft-deletes the Profile, so the cascade never fires and that flow has to delete
  notifications itself.

## Global candidate search

`GET /v1/search/candidates`, recruiter-only. Discoverability is the `candidate_search_profiles`
view (searchable + not deleted + `ready` current CV + has chunks). Vector search:
```sql
select distinct on (ch.candidate_id)
       s.*, ch.chunk_type, ch.chunk_text, (ch.embedding <=> :query_embedding) as distance
from candidate_profile_chunks ch
join candidate_search_profiles s on s.candidate_id = ch.candidate_id
order by ch.candidate_id, distance          -- then order the result by distance, limit :k
```
`distinct on` is what keeps a candidate to one place in the ranking, holding the chunk of
theirs that matched best; that chunk is returned as the evidence for the hit.

Optional filters AND onto the join: structured predicates on the view (location matched
inside, preferred language exactly) and, when the recruiter supplies explicit keywords,
`candidates.search_vector @@ websearch_to_tsquery('english', :keywords)`. Semantics come from
the vector ranking; FTS is a hard filter only — there is no rank fusion.

Every column of a result comes from the view, which has neither email nor phone. Never expose
another tenant's notes/tags/applications/comms.

Embedding the query needs the same provider the worker embeds chunks with. Where no key is
configured the API still starts and this one endpoint answers 503.

## Storage

CV files live in the private `cvs` bucket. Uploads go **through the API** (multipart,
≤10 MB): the backend streams the file to Storage with the service role, computes the
SHA-256 `file_hash` while streaming, rejects active duplicates for the candidate (409,
per the partial-unique index), and inserts the `cvs` row — so object, row, and the
trigger-enqueued parse job succeed or fail together and the hash is never
client-supplied. Downloads are short-lived signed URLs issued by the API. No client
touches Storage directly.

The object cannot join the row's transaction, so the ordering is: write the object, insert
the row, and **remove the object again** if the insert does not land. That is the only order
where a failure leaves nothing behind — including the loser of a duplicate race, which has
written its object before the unique index refuses it. The path is
`{candidate_id}/{cv_id}{extension}`, built from the media type the API accepted rather than
from anything the candidate typed.

## Invariant ownership summary

| Invariant | Enforced by |
| --- | --- |
| Candidate XOR recruiter; CV/tenant ownership FKs; one application/job; answer↔question; tag scope; date/enum/range CHECKs; criteria lock; a tracked link belongs to its job's tenant; one link name per job; partial-unique CV; notification payload↔type agreement; a notification about an Application is the applicant's | **Database** |
| Auth (JWT), per-user/tenant authorization, CV `ready` before apply, all required questions answered, screening rules, job lifecycle transitions, what the public may read, tracked-link attribution, chunk atomic-swap, queue backoff, verified-email resolution, notifying and confirming in the announcing transaction | **Backend** |
