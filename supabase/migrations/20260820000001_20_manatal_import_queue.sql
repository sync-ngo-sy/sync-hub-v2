-- Queue-driven Manatal import: the dashboard enqueues work, the worker performs it.

create type manatal_import_job_kind as enum ('plan', 'import', 'publish');

create type manatal_import_job_status as enum ('pending', 'processing', 'completed', 'failed');

create type manatal_import_entry_state as enum (
  'pending',
  'imported',
  'published',
  'no_email',
  'no_resume',
  'already_registered',
  'failed'
);

-- One row per Manatal candidate this tenant is bringing across. The ledger the CLI used to
-- keep in a file beside the script.
create table manatal_import_entries (
  tenant_id             uuid not null references tenants (id) on delete cascade,
  manatal_candidate_id  text not null,

  state                 manatal_import_entry_state not null default 'pending',
  full_name             text not null default '',
  email                 text not null default '',
  candidate_id          uuid references candidates (id) on delete set null,
  cv_id                 uuid references cvs (id) on delete set null,
  file_hash             text,
  error_message         text,

  position              text,
  company               text,
  degree                text,
  university            text,
  graduation_year       int,
  english               text,

  attempts              int not null default 0 constraint manatal_import_entries_attempts_nonneg check (attempts >= 0),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  primary key (tenant_id, manatal_candidate_id)
);

create index manatal_import_entries_state_idx
  on manatal_import_entries (tenant_id, state);

create table manatal_import_jobs (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants (id) on delete cascade,
  recruiter_id          uuid not null references recruiters (id) on delete restrict,

  kind                  manatal_import_job_kind not null,
  manatal_candidate_id  text,

  status                manatal_import_job_status not null default 'pending',
  attempts              int not null default 0 constraint manatal_import_jobs_attempts_nonneg check (attempts >= 0),
  error_message         text,

  available_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),

  constraint manatal_import_jobs_candidate_required check (
    kind = 'plan' or manatal_candidate_id is not null
  )
);

create index manatal_import_jobs_claim_idx on manatal_import_jobs (available_at)
  where status in ('pending', 'processing');

create index manatal_import_jobs_status_created_idx on manatal_import_jobs (status, created_at);

create trigger manatal_import_jobs_notify_worker
  after insert on public.manatal_import_jobs
  for each statement
  execute function public.notify_worker_of_enqueue();
