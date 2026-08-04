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

A `profiles` row must exist before its `candidates`/`recruiters`/`platform_admins` row, and
`account_type` is fixed at creation. A Profile is exactly one of the three, enforced by the
composite FK (supabase ADR-0001, amended by supabase ADR-0003).

- **Candidate signup**: in one tx → `insert profiles(id=auth.uid(), account_type='candidate',
  full_name, …)` then `insert candidates(id=auth.uid())`. The candidate insert enqueues an
  (empty) re-embed job automatically. No transaction spans GoTrue and Postgres, so the
  identity is created first and **deleted again** if the tx (or the confirmation email)
  fails — `profiles.id → auth.users(id) ON DELETE CASCADE` makes that one call undo
  everything, leaving the address free to sign up again.
- **Recruiter invite**: `insert profiles(id, account_type='recruiter', …)` then
  `insert recruiters(id, tenant_id, role)`.
- **Platform admin bootstrap**: `insert profiles(id, account_type='platform_admin', …)` then
  `insert platform_admins(id)`, in one tx, with the identity deleted again if it fails — the
  same undo candidate signup uses. No endpoint does this: the first Platform admin has nobody
  to authorise them, so `scripts/create_platform_admin.py` is run against a target environment
  and the address is confirmed on the spot, there being no portal to send a link to.
- **Founding admin invite**: the same two inserts as a recruiter invite, alongside the `tenants`
  row they will run — see *Platform operations* below.
- Do **not** rely on an `auth.users` trigger; the flow decides the role, so the backend writes
  both rows.
- There is **no Tenant signup**. Sync is sold, not self-served: no public endpoint creates a
  `tenants` row, and the rule lives here rather than in a hidden button. A company asks with an
  `access_requests` row, and a Platform admin converts it — see *Access requests* below.

## Platform operations (`sync_api.platform`)

What a Platform admin does to the platform as a whole. Every route under `/v1/platform` carries
one router-level guard, so who may reach them is a single decision rather than one per route.

- **Listing Tenants** reads every `tenants` row — suspended ones included — with two correlated
  subqueries beside it: `member_count`, which counts *every* `recruiters` row of the tenant and so
  includes colleagues an admin has deactivated; and `invite_pending`, which is
  `email_confirmed_at is null` on the founding admin below. No tenant filter anywhere: this is the
  one reader on the platform that is deliberately not scoped to one.
- **Opening a Tenant** writes three rows — `tenants`, then
  `profiles(account_type='recruiter')`, then `recruiters(role='admin')` — in one transaction
  (`sync_api.tenants.provisioning.provision_tenant`). It is the only way a `tenants` row is ever
  made, whether an operator typed it or converted an Access request. The founding admin is
  **invited**, never given a password: GoTrue's invite creates the identity, and the address is
  confirmed only once they redeem the link and choose one.
- Both refusals — an address (`tenants.slug`) already taken, an email address that already has an
  account — are asked **before** the invitation goes out, so a request that cannot succeed never
  puts a link in somebody's inbox. `tenants_slug_key` and `profiles_pkey` stay the backstop for
  the race. A failure after the invite deletes the identity again, **except** where `profiles_pkey`
  is what refused: that Profile is somebody's account, and deleting its identity would cascade the
  account away with it. That exception is not theoretical — two requests inviting the same address
  both pass the check, and GoTrue answers the second with the *same* user it minted for the first,
  so the loser must not undo what the winner now owns.
- **The founding admin** is a Tenant's *first* `recruiters` row (`created_at`, then `id`). Nothing
  marks it and nothing needs to: a Tenant is opened with exactly one recruiter, and the roster only
  ever grows from there.
- **Resending an invitation** calls GoTrue's invite again for the same address, which supersedes
  the previous link. `auth.users.email_confirmed_at` is what says an invitation is still
  outstanding; once it is set there is nothing to resend and the request is a 409.
- **Suspension** flips `tenants.is_active` and needs no new enforcement — resolving a Recruiter's
  tenant access and serving a Job both already read it. Nothing is deleted, so a restored Tenant
  comes back with its roster, Jobs and Applications exactly as they were.
- **Plan** (`tenants.plan`) is reported and never written. Nothing on the platform reads it yet,
  so a control for it would be a switch wired to nothing.
- **Platform counts** are four `count(*)` subqueries in one round trip. Candidates are counted
  `where deleted_at is null`: a deleted Candidate keeps its row, because the Applications Tenants
  received still name it.

## Access requests (`sync_api.access_requests`)

Where every Tenant starts, and the one row an unauthenticated stranger may write.

- **Asking** inserts into `access_requests` with `on conflict do nothing` against the partial
  unique index `access_requests_one_pending_per_email_idx` (`email` where `status = 'pending'`), so
  a second ask from the same address is ignored rather than queued — and the first ask stands.
  Deliberately *not* an upsert: nobody proves they own an address here, so `do update` would let a
  stranger who knows a waiting address rewrite the `company` and `full_name` the operator reads,
  and `company` is what the Tenant gets called on conversion. The address is lowercased before it
  is written, because that index is a plain equality. The endpoint answers `202` with no body:
  what a stranger asked for is not theirs to read back, and the answer must not disclose whether
  the address was already waiting.
- **Its own rate limit.** Nothing here touches GoTrue, so none of the identity provider's limits
  apply. `SYNC_ACCESS_REQUEST_RATE_LIMIT_*` is what stands between the queue and a script, and it
  is deliberately tighter than the public browse limit — a company asks once.
- **Converting** calls the same `PlatformService.create_tenant` an operator uses by hand, with
  the company, the founding admin and their address read off the row; only `slug` comes from the
  request body. The row is marked `converted` and points at the Tenant it became **after** the
  Tenant exists, so a refusal (slug taken, address already an account) leaves it `pending` and
  correctable rather than lost. The two are not one transaction: `create_tenant` owns its own, and
  the window is one status update wide.
- **Dismissing** marks the row `dismissed` and does nothing else — no Tenant, no email. Neither
  decision deletes the row, which is what makes a company's second ask visibly a second one.
- `access_requests_decision` is the CHECK that keeps the three states honest: `pending` has no
  `decided_at` and no `tenant_id`, `dismissed` has a `decided_at` and no `tenant_id`, and
  `converted` has both. `tenant_id` is `ON DELETE SET NULL` — the request outlives the Tenant.

## Candidate profile replacement

A Candidate keeps **one** profile, and it is the only source an Application is ever built from.
`PUT /v1/candidates/me/profile` replaces it whole, in one transaction, service role. The
candidate row is locked `FOR UPDATE` and updated, and every `candidate_*` child row is deleted
and re-inserted — never matched up and patched — so no reader ever sees a half-saved profile and
`sort_order` is simply the position each entry had in the request. The lock is what makes
concurrent saves last-write-wins: without it each transaction deletes only what the other has
already committed, and both sets of inserts survive.

One profile spans two tables, and the `PUT` writes both in that same transaction:
`profiles.full_name`/`phone` (the identity) and `candidates` plus its children (the claims).
`email` is **not** settable here — only `auth.users` holds a confirmed address, and changing one
stays an auth flow with re-confirmation.

`candidates.unmapped_skills text[] not null default '{}'` holds the skills a Candidate claims
that the Canonical taxonomy has no name for. They persist, they feed the search embedding
(`sync_rag.chunks`, in the `skills` chunk), and Screening never reads them. Pydantic caps the
list at `MAX_ENTRIES`, each entry at `MAX_LINE_LENGTH`, and deduplicates case-insensitively.
`application_profile_snapshots.unmapped_skills text[] not null default '{}'` is its frozen twin,
copied with the rest of the Snapshot. Neither column needed a new trigger: `reembed_on_change`
and `set_updated_at` already fire on `candidates`.

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
4. `candidate_skills.years_experience` is `NOT NULL` with **no default**, so every skill on a
   saved profile carries years and a skill without them is a located 422. The parser refuses to
   guess years for a reason: blank means unknown and Screening routes it to a human, while `1`
   is compared against a Job's `minimum_years` and **auto-rejects** — so a defaulted `1` would
   silently discard a ten-year engineer.

The re-embed queue looks after itself: every one of those writes fires
`enqueue_candidate_reembed`, which upserts the candidate's single `candidate_embedding_jobs`
row, so any number of successive saves leaves exactly one dirty job with a bumped `revision`.

### Filling a profile from a CV

`GET /v1/candidates/me/cvs/{cv_id}/profile-draft` computes a `ProfileDraft` from
`cvs.parsed_cv_data` and **persists nothing**; 409 unless `parsing_status = 'ready'`. The
Candidate reviews it, edits it, and `PUT`s it back — which is the only way a profile gets
populated.

Only skills merge. They have a natural key (the Canonical name, and so `taxonomy_id`), so the
years the Candidate typed by hand survive a re-import: the draft carries over every skill
already on the profile with its `years_experience`, and adds the skills this CV names that were
not there with `years_experience` null. Experiences, educations, languages and projects have no
such key — matching them by shape would leave duplicates to delete by hand — so they come from
the CV alone. `ProfileDraft` is therefore a distinct type from `CandidateProfile`, with
`skills[].years_experience` nullable: a draft is incomplete by nature, a saved profile never is.

`is_searchable` and `preferred_language_code` are taken from the Candidate's current values, not
the CV. They are settings, and a CV's `detected_language` is the language the document happens
to be written in — a CV written in English by someone who wants Arabic would get the wrong one.

## A candidate's CVs: how many, which is current, deleting one

A Candidate keeps at most **five active CVs** — active meaning not soft-deleted, whatever each
one's `parsing_status`. That is a count across rows, so the backend owns it: the upload refuses
the sixth with a 409 before it writes anything, and counts again inside the insert's transaction
with the candidate row locked `FOR UPDATE` — without the lock two uploads at once each count the
CVs from before the other's insert, and six land.

`candidates.current_cv_id` is the CV the candidate applies and is found with. It moves when they
say so (`POST /v1/candidates/me/cvs/{id}/make-current`), or by itself onto their first `ready`
CV (see CV ingestion below). Only a `ready` CV may take it: a CV still being read, or one whose
parse failed, is refused with 409 `cv-not-ready`. The UPDATE is guarded on the value actually
changing, because `reembed_on_change` fires on *any* write to the candidate row and a CV made
current twice is no reason to re-embed a profile.

Deleting a CV is **soft** — `cvs.deleted_at`, the row and the Storage object both left alone:
1. The current CV is refused with 409 `cv-is-current`, telling the candidate to make another one
   current first. So a searchable profile can never be stranded without a CV, and
   `candidates_searchable_needs_cv` never has to catch it.
2. Both directions of that are triggers too (migration 07), which is why every writer of
   `current_cv_id` locks the candidate row: `forbid_deleting_current_cv` refuses soft-deleting
   the CV that is current — taking the same `FOR UPDATE` lock, so a switch racing a delete
   cannot interleave into a deleted CV being current — and `forbid_deleted_current_cv` refuses
   pointing `current_cv_id` at a CV that is already deleted.
3. `applications.(candidate_id, cv_id)` still resolves, and the object is still there, so a
   Tenant reviewing an Application goes on reading the CV and downloading the file it was
   submitted with. What the candidate keeps in their own list is not the record of what they sent.
4. Dedup is over *active* CVs only (the partial unique index), so deleting a CV — a failed parse,
   typically — frees that exact file to be uploaded again.

## Jobs: the criteria lock, and what the public may read

A Job's *criteria* — `job_skills`, `job_languages`, `job_application_questions` and
`jobs.minimum_total_experience_years` — are one thing that freezes together, so
`PUT /v1/tenants/me/jobs/{id}/criteria` replaces all four at once, deleting and re-inserting
the child rows rather than matching them up. The rest of the Job (`title`, `description`,
`location_key`, `employment_type`, `work_mode`, `expires_at`) and the lifecycle move through a
separate `PATCH`, which is why a typo can still be fixed after the applications start arriving.

`jobs.location_key` references `locations`, and the public board filters it with `=` — never a
substring, which used to answer a search for Damascus with Jobs in Rif Dimashq. A key the
taxonomy does not have is refused at `body.location_key` before anything is written.

`jobs.published_at` is write-once, and the backend is the only thing keeping it so: nothing in
the schema stops an `UPDATE` from rewriting it. It is stamped on the move that first takes a
Job to `published` and never again — not on a republish out of `closed`, which would date a Job
open since March to this week, and not on an ordinary edit. That second case is the sharp one:
every Job published before the column existed carries a null and is deliberately not
backfilled, so a rule that only asked "is it published and null?" would stamp one the next time
anybody fixed its title. Applications record their moves in `application_status_history`; Jobs
record none, which is why this one column is written this carefully.

`employment_type` and `work_mode` are enums, not prose and not tables: closed sets that change
approximately never, which reach both portals through the generated client rather than being
listed by hand in either. `employment_type` was `text`, so "Full time" and "Full-time" were two
kinds of job and the board's filter had to `lower()` both sides and still miss; it is an equality
on the enum now, and a value outside the set is a 422 rather than an empty page. `work_mode`
answers a different question from `location_key` and never replaces it — a `remote` Job still
carries the Location its team sits in, which is what keeps "Remote" out of the place taxonomy.

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
always first. That vector is trigger-maintained rather than generated, because it reaches
through `location_key` for the Location's name — a generated column may only read its own row —
and `candidates.search_vector` is the same shape for the same reason. A public payload never
carries `accepted_boolean_answer`; which answer passes a knockout question is the Job's
business, not the applicant's.

Reading one Job writes a `job_view_events` row — through a tracked link, with that link's id
in it. The `session_id` is the platform's own `sync_visitor` cookie (issued on the first
read, so it says "the same browser came back" and nothing else) and `visitor_hash` is a
salted SHA-256 of address and user agent, so the analytics table cannot be walked back to the
people in it. A `tracked_job_links` row that is inactive, past its `expires_at`, or points at
a Job the public cannot see resolves to the same 404 as a token that was never issued.

## Application submission (the core transaction)

Single DB transaction, service role. The DB guarantees structure; the backend must validate
everything below **before** committing.

The request body is `{job_id, answers}` and nothing else. There is no `cv_id`, no `profile` and
no `update_profile`: the Snapshot is copied from the live profile server-side, so there is no way
to apply with data the profile does not hold. Choosing a CV is a profile-settings action.

Backend-enforced preconditions (not expressible as constraints). The first three are answered
**before** the transaction opens, so the common refusals never begin an Application; the two
that read the profile run **inside** it, with the candidate row locked `FOR UPDATE`, and take
the whole submission back with them:
1. The Job is one the public may read — `public_jobs()`, the same predicate browse uses. A Job
   nobody can read is a Job nobody can apply to, and both answer the same 404.
2. Every `is_required` question of the job is answered, and each answer's type matches
   (`yes_no` → `answer_boolean`, `short_text` → `answer_text`). *(The single-answer-kind CHECK
   and the answer→question FK are DB-enforced; "all required answered" is not.)* One 422 names
   every offending entry — unanswered, mistyped, or asked by some other Job.
3. The candidate has not applied to this Job already: 409 carrying `application_id`. Withdrawal
   permanence falls out of the same rule — a withdrawn Application still holds its job, because
   `UNIQUE(candidate_id, job_id)` does not care what state it is in. The unique index refuses
   one that lands between this check and the write, and the `IntegrityError` answers the same
   409.
4. `candidates.current_cv_id` is not null (409 `no-current-cv`). That the CV exists and is not
   deleted is the database's answer already — `forbid_deleting_current_cv` and
   `forbid_deleted_current_cv` — so the pointer being set is all that is left to check. How far
   its parse got is **not** checked: every upload is parsed, and a Candidate who swapped to an
   unread CV is not applying with worse data than the profile they already reviewed.
5. The profile is worth judging: at least one skill, and either an experience or an education
   (422 `incomplete-profile`, whose `detail` names what is missing). Skills and languages are
   **not** re-validated here — `PUT /candidates/me/profile` already guarantees every
   `taxonomy_id` and `language_code` in the live tables, so `sync_api.vocabulary` no longer runs
   on this path.

Why 4 and 5 are inside the lock: both read the same live profile the Snapshot is then copied
from, and every writer of a profile queues on the candidate row. Checked outside it, a
`PUT /candidates/me/profile` landing in between would leave an Application whose Snapshot is
thinner than the profile that passed — an empty Snapshot screened on nothing, which is the state
these two exist to prevent.

DB-enforced on write (rely on these — a backend bug cannot bypass them):
- `applications.(tenant_id, job_id)` → `jobs` (tenant match); `(candidate_id, cv_id)` → `cvs`
  (CV ownership); `UNIQUE(candidate_id, job_id)` (one application per job).
- `application_answers.(job_id, question_id)` → real question of the job; answer-kind CHECK.

Write order in the tx:
```
select candidates for update                    -- what every writer of the profile queues on
-- then preconditions 4 and 5 above, which read the profile this is about to copy
insert applications(id, tenant_id, candidate_id, job_id, cv_id, tracked_link_id)
insert application_profile_snapshots  select from profiles ⋈ candidates    -- the scalar row
insert application_experiences/_educations/_skills/_languages/_projects
                                      select from the candidate_* twin     -- one per table
insert application_answers(application_id, job_id, question_id, answer_*)
insert application_status_history(application_id, change_source='candidate', new_status='new')
-- then read the rows just written and run screening (below) synchronously, inside this same
-- transaction — an application is never observable without its verdict
insert communications(...)                      -- the confirmation, status='queued'
```
The Snapshot is six **column-listed `INSERT … SELECT`s**: one `profiles ⋈ candidates` join for
the scalar row, and one per child table. The invariant that makes that possible is **identical
column names on both sides, and exactly one live source per field** — which is what keeps the
copy mechanical and kills the add-a-column-forget-to-map-it bug. `application_*` and
`candidate_*` are column-for-column twins; the only differences are the parent FK's name and the
`created_at`/`updated_at` the candidate children carry and the immutable application children
correctly do not.

Two deliberate asymmetries: `full_name` and `phone` come from `profiles`, because they are the
candidate's identity rather than a per-application claim; and `preferred_language_code`,
`is_searchable` and `current_cv_id` are **never** snapshotted, because they are settings and
pointers — freezing a setting would leave someone asking why changing it changed nothing.
`email` is on neither side: only `auth.users` has a confirmed one, and `delivery.py` resolves it
there on every send.

The Snapshot is immutable from the moment it is written, and submission writes **nothing** back
to the live profile. The review moment has moved from per-application to per-profile-edit: there
is no per-Job tailoring, and one Application per Job (a withdrawn one still counting) means a
frozen mistake cannot be retried.

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
`candidate_*` tables, and never `unmapped_skills` on either side. Rules (all mandatory criteria
must pass ⇒ `qualified`):
- required skill absent → `disqualified`; required-skill years < `minimum_years` →
  `disqualified`; unknown years for a required skill → `review_required`. That last branch is
  unreachable now that `years_experience` is `NOT NULL` on both sides; the rule stays because
  Screening should not be the thing that decides what a missing number means.
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
alone — no constraint or trigger knows about it, so the row is read `FOR UPDATE` inside the
move's transaction: without that, two moves decided at once would each pass a check the other
should have failed:
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

## AI match assessments (advisory, append-only)

A Recruiter asks for one; it runs synchronously and writes exactly one row:
```
insert application_ai_match_assessments(application_id, match_percentage, explanation,
       assessment_details, model_name, prompt_version);
```
Its input on the Candidate's side is the immutable `application_*` snapshot — what they froze
when they applied, never their live `candidate_*` rows. On the Job's side it is the criteria
Screening measured (`job_skills`, `job_languages`, `jobs.minimum_total_experience_years`) plus
the Job's own words (`title`, `description`, its Location's name, `employment_type`), which lets
a model say anything the deterministic verdict could not. The employment type is written into the
document as English — a model reads "Full time", not `full_time`. Those words are read as they
stand: the criteria lock freezes the bar once an Application arrives, and deliberately not the
prose.
Nothing else is written: `applications.qualification_status`, `qualification_reason` and
`application_qualification_history` are Screening's, and no number of assessments is a word in
them. Running it again appends; the history reads newest first (`created_at desc, id desc`,
keyset-paged) and nothing ever overwrites an earlier row.

`match_percentage` is `numeric(5,2)` under a 0–100 CHECK, and the model's number is clamped
into that range at the port's edge — the strict-schema subset a provider accepts carries no
`minimum`/`maximum`, so the column's range cannot be asked of the model itself.
`assessment_details` holds the strengths and gaps as jsonb, read back defensively: a row an
older `prompt_version` wrote is still read by today's code. `model_name` and `prompt_version`
are what make an assessment auditable after either changes.

The model is called with no transaction open — the reads above are rolled back first, so a
provider taking its time holds no Postgres connection — and the insert is its own transaction
afterwards. A provider failure therefore leaves nothing behind (502), and a deployment with no
`SYNC_OPENAI_API_KEY` answers 503 while still serving the history.

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
  other field is coerced to the limits in `sync_core.profile` — the review screen posts the draft
  built from this parse back to `PUT /v1/candidates/me/profile`, so a parse it would refuse is
  unusable. The parse is not on the CV payload; it reaches the candidate only as a
  `ProfileDraft` (see *Filling a profile from a CV* above).
- The candidate's **first** `ready` CV sets `candidates.current_cv_id` if it is still unset, with
  the candidate row locked `FOR UPDATE`. Only the first: after that it is the candidate's choice.
  A CV **soft-deleted while it was being read** is not adopted — it is parsed and stored like any
  other, and simply never becomes current.
- A dead job also inserts the candidate's `cv_parse_failed` **Notification**, in `give_up`'s own
  transaction (see Notifications below) — so the progress indicator never ends in silence, and
  no candidate is told about a failure the transaction then rolled back. If the `cvs` row has
  been deleted meanwhile there is nothing to fail and nobody to tell, and the consumer says so
  in the log rather than writing a notification whose recipient it cannot name. A soft-deleted
  CV still gets its `failed` status, but no Notification: the candidate has stopped waiting.

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
- `communication_type` spells exactly the three messages a Candidate is ever emailed: the
  receipt, the rejection a human decided, and `recruiter_message` — what a Recruiter wrote them
  from a Message template. A status change and a failed CV parse are Notifications, not
  Communications, which is why neither is a value here.

## Message templates (`message_templates` → `sync_api.messaging`)

A Tenant's reusable, named subject/body, rendered into one Communication when a Recruiter
messages an applicant. `/v1/tenants/me/message-templates`, plus
`POST /v1/tenants/me/applications/{id}/messages` to send from one.

- **The placeholder vocabulary is the backend's**, not the database's: the fields of
  `sync_api.messaging.placeholders.Placeholders` (candidate name, job title, tenant name) are
  the whole set, and `KNOWN` is derived from them so nothing can pass validation that send time
  could not fill. A `{{ … }}` naming anything else — including a malformed one like
  `{{ Job Title }}` — is a 422 at **save** time, on the field that wrote it. A template is
  saved once and sent from for months, so the recruiter who typed it is the one who should hear.
- Substitution is a plain regex over `{{ name }}`, deliberately not a template engine: a
  recruiter's typing is data, and nothing a tenant writes is ever evaluated. Whitespace inside
  the braces is theirs, so `{{name}}` and `{{ name }}` are one placeholder.
- **Placeholders resolve once, in the API, at send time**, and the resolved subject and body are
  what the Communication's `payload` carries. So the audit of what a Candidate was sent survives
  the template being rewritten or deleted, and the sender never renders a tenant's prose: its
  `recruiter-message.v1` template only wraps the already-resolved words in an envelope, turning
  the plain-text body into paragraphs (autoescaped — a recruiter's typing cannot reach the
  markup either).
- `unique (tenant_id, name)` is what a duplicate name 409s on; that index is also the ordering
  the listing reads, and the listing does not page. Any recruiter of the Tenant may send from,
  rewrite or delete any of them; `created_by_recruiter_id` records who first wrote one and never
  changes. `updated_at` is the `set_updated_at` trigger's, so a revision `refresh`es before
  answering.
- Sending resolves the Application through `own_application` and the template through
  `own_message_template`, both scoped by tenant **in the query** — so another tenant's applicant
  and another tenant's template are each the same 404, and the recruiter-initiated shape the
  `communications` CHECKs demand cannot be satisfied with anything but this tenant's own.
- Each send is its own decision: the same template sent twice is two Communications. There is
  nothing in the request to derive an idempotency key from, so a fresh one is minted — it is the
  provider's guard against a re-claimed row, not request-level idempotency.

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

## Tenant CRM (notes, tags, talent pool)

The tenant-private knowledge layer: `notes`, `tenant_tags`, `candidate_tag_assignments`,
`application_tag_assignments` and `talent_pool_members`. Every one of them carries `tenant_id`,
and every read filters on it **in the query** — another tenant's note, tag or pool entry must
be the same 404 as one that never existed.

- **One `notes` table, two subject columns.** `application_id` and `candidate_id` are both
  nullable and `notes_one_subject` (`num_nonnulls(…) = 1`) makes exactly one of them set, so a
  note about a Candidate and a note on an Application stay distinct records while sharing one
  table, one trigger and one code path. Two columns rather than a `subject_type`/`subject_id`
  pair because each keeps a **real** foreign key — and its own delete rule (below). Every read
  filters the subject column as well as `tenant_id`, so a candidate note can never surface
  through an Application's endpoint. The composite FK is MATCH SIMPLE, so the null half of a
  row leaves its key unchecked rather than demanding a row that cannot exist.

- **Reach** is what a recruiter is allowed to keep a record *on*. An Application: the tenant's
  own (`own_application`) — a property an Application never loses. A Candidate: one who has
  applied to this tenant, or one who is `is_searchable` and not soft-deleted — the two places a
  recruiter meets a Candidate, since the pool's whole point is saving a Global search hit —
  **or one this tenant has already filed** (a note, a tag assignment, or a pool entry of its
  own). That last clause is not convenience: without it a Candidate who opts back out of
  Global search, or soft-deletes, would strand the notes, tags and pool entry a tenant wrote
  while it could still see them — listed but permanently unreadable and un-removable. Anyone
  else is a 404, so candidate ids cannot be walked.
- **Tag scope is the database's guard, not the backend's.** An assignment row leaves `scope`
  to its column default (`'application'` / `'candidate'`), so the composite FK
  `(tag_id, scope) → tenant_tags (id, scope)` is what proves the Tag belongs on that kind of
  thing. The backend catches that one constraint by name and answers 409
  `tag-scope-mismatch`; it never pre-checks the scope itself. The `scope = '…'` CHECK on each
  assignment table stops a backend bug from writing a row whose `scope` disagrees with the
  table it is in.
- Which tenant's Tag it is, though, *is* checked first (`own_tag`), so borrowing another
  tenant's Tag is a 404 rather than a constraint message.
- **Assignment and pool membership are sets**: `insert … on conflict do nothing`, so putting a
  Tag on twice or saving a Candidate twice leaves one row with its original timestamp, and the
  endpoints are `PUT`/`DELETE` rather than `POST`. Taking off what was never on is a 204.
- **Deleting a Tag unfiles it, in the database.** Both foreign keys of each assignment table
  cascade from `tenant_tags`, so unfiling is not something a caller can forget to do. The
  cascade is indexed: `*_tag_assignments_tag_idx (tag_id)` leads both keys.
- A note's `recruiter_id` is the author and is written once; `updated_at` is the
  `set_updated_at` trigger's to write, so an edit has to `refresh` the row before answering
  with it or the response echoes the timestamp from before the edit. Any recruiter of the
  tenant may rewrite or delete any of its notes — they are the Tenant's record, not the
  individual's — and the recorded author does not change when they do.
- Note lists are keyset-paginated on `(created_at desc, id desc)`, the talent pool on
  `(added_at desc, candidate_id desc)`, and each has the index that ordering asks for:
  `notes_application_created_idx` and `notes_tenant_candidate_created_idx` (both partial, so
  neither carries the other subject's rows) and `talent_pool_members_tenant_added_idx`. The
  pool reads names and headlines live from `profiles`/`candidates`; there is no snapshot here,
  unlike an Application.
- A note on an Application, and `application_tag_assignments`, cascade with the Application
  (`ON DELETE CASCADE` on the composite FK). A note about a Candidate,
  `candidate_tag_assignments` and `talent_pool_members` do not cascade from a Candidate:
  account deletion soft-deletes the Profile, so a tenant's own record of them is deliberately
  its own to remove — which is also why Reach outlives the Candidate leaving.

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

Optional filters AND onto the join: structured predicates on the view (Location key exactly,
preferred language exactly) and, when the recruiter supplies explicit keywords,
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

Deleting a CV never deletes its object: the deletion is soft precisely so that the Applications
already made with the CV keep their file (see "A candidate's CVs" above).

The object cannot join the row's transaction, so the ordering is: write the object, insert
the row, and **remove the object again** if the insert does not land. That is the only order
where a failure leaves nothing behind — including the loser of a duplicate race, which has
written its object before the unique index refuses it. The path is
`{candidate_id}/{cv_id}{extension}`, built from the media type the API accepted rather than
from anything the candidate typed.

## Invariant ownership summary

| Invariant | Enforced by |
| --- | --- |
| A Profile is exactly one of candidate, recruiter, platform admin; a tenant's address is unique; CV/tenant ownership FKs; one application/job; answer↔question; tag scope; unfiling a deleted Tag; exactly one subject per note; date/enum/range CHECKs; criteria lock; a tracked link belongs to its job's tenant; one link name per job; one template name per tenant; a recruiter-initiated Communication has an Application of that recruiter's tenant; partial-unique CV; a deleted CV is never a candidate's current CV; notification payload↔type agreement; a notification about an Application is the applicant's | **Database** |
| Auth (JWT), per-user/tenant authorization, CV `ready` before becoming current, a current CV and a profile worth judging before apply, how many CVs a candidate may keep, refusing to delete the current CV with the guidance to switch first, all required questions answered, screening rules, job lifecycle transitions, `jobs.published_at` being written once on the move that first publishes a Job, what the public may read, tracked-link attribution, chunk atomic-swap, queue backoff, verified-email resolution, notifying and confirming in the announcing transaction, which Candidates a Tenant may keep a record on, the placeholder vocabulary and resolving it before a message is queued, platform operations being reachable only by a Platform admin, an address and an email address being checked before an invitation is sent | **Backend** |
