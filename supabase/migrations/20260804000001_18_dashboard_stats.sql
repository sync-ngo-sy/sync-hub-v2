-- What the Recruiter Dashboard reads. Until now every number on that page was counted in the
-- browser, because nothing here could answer "how many" without listing the rows first.
--
-- Two things were missing: a record of when a Job went live, and indexes for the tenant-wide
-- reads. Neither changes what the schema means — no new table, no new invariant.

-- A Job's `created_at` is when somebody started drafting it; nothing recorded when it actually
-- went live. Applications have `application_status_history`, Jobs have nothing, so "2 Jobs opened
-- this week" was not a question this schema could answer: a Job drafted in March and published
-- yesterday would not count, and a draft written this week wrongly would.
--
-- Null for every Job published before this migration, and deliberately not backfilled. The only
-- question asked of it looks back seven days, so `created_at` would be a guess that is wrong in
-- exactly the cases that matter, and leaving it null self-heals within a week of deploy.
--
-- Written on the first draft -> published move and left alone afterwards: a Job closed and
-- republished went live when it first went live, not when it came back.
alter table jobs add column published_at timestamptz;

comment on column jobs.published_at is
  'When this Job first went live. Null while it has never been published, and never rewritten '
  'by a later republish.';

create index jobs_tenant_published_at_idx on jobs (tenant_id, published_at);

-- The tenant-wide reads. `applications` is indexed per Job (`applications_job_status_idx`), which
-- is what a Job's own triage list pages on, but the Dashboard asks across every Job of a tenant —
-- and the only index leading with `tenant_id` was the `(tenant_id, id)` unique constraint, whose
-- second column is no help to either question below.

-- Serves both the rolling windows ("received in the last 7 days") and the cursor of the new
-- tenant-wide Applications list, which pages on `(applied_at desc, id desc)`.
create index applications_tenant_applied_at_idx on applications (tenant_id, applied_at desc, id desc);

-- Serves the counts by Pipeline stage, which group every one of the tenant's Applications.
create index applications_tenant_status_idx on applications (tenant_id, status);

-- Serves the cursor of the new tenant-wide Tracked links list. Links were only ever listed one
-- Job at a time before it (`tracked_job_links_job_active_idx`).
create index tracked_job_links_tenant_created_idx
  on tracked_job_links (tenant_id, created_at desc, id desc);
