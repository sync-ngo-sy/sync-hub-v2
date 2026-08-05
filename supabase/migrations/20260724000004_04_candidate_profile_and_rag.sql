-- profile_version (DBML) is intentionally gone (ADR supabase-0002): any candidate_* change
-- enqueues a coalesced re-embed, and the worker re-embeds from the CURRENT profile.

set search_path = public, extensions;  -- so vector(...) and vector_cosine_ops resolve

create table candidate_experiences (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,

  company_name text,
  job_title    text not null,

  -- Dated, always: Total experience is derived from these entries and stored as one number, and
  -- that number is only honest if every job behind it could be measured. A start year always,
  -- and an end year unless the job is still held.
  start_year  int not null,
  start_month int,
  end_year    int,
  end_month   int,

  is_current  boolean not null default false,
  description text,
  sort_order  int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cexp_finished_work_has_an_end check (is_current or end_year is not null),
  constraint cexp_start_month_range check (start_month is null or start_month between 1 and 12),
  constraint cexp_end_month_range   check (end_month   is null or end_month   between 1 and 12),
  constraint cexp_start_year_range  check (start_year  is null or start_year  between 1900 and 2100),
  constraint cexp_end_year_range    check (end_year    is null or end_year    between 1900 and 2100),
  constraint cexp_ordered check (
    start_year is null or end_year is null
    or end_year > start_year
    or (end_year = start_year and coalesce(end_month,12) >= coalesce(start_month,1))
  ),
  constraint cexp_current_has_no_end check (not is_current or (end_year is null and end_month is null))
);
create index candidate_experiences_start_year_idx on candidate_experiences (candidate_id, start_year);
create index candidate_experiences_sort_order_idx on candidate_experiences (candidate_id, sort_order);

create table candidate_educations (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,

  institution     text not null,
  degree          text,
  field_of_study  text,
  graduation_year int,

  description text,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cedu_grad_year_range check (graduation_year is null or graduation_year between 1900 and 2100)
);
create index candidate_educations_grad_year_idx  on candidate_educations (candidate_id, graduation_year);
create index candidate_educations_sort_order_idx on candidate_educations (candidate_id, sort_order);

create table candidate_skills (
  candidate_id uuid not null references candidates (id) on delete cascade,
  taxonomy_id  uuid not null references skill_taxonomy (id),

  years_experience numeric(4,1) not null
    constraint cskill_years_nonneg check (years_experience >= 0),

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (candidate_id, taxonomy_id)
);
create index candidate_skills_taxonomy_idx   on candidate_skills (taxonomy_id, candidate_id);
create index candidate_skills_sort_order_idx on candidate_skills (candidate_id, sort_order);

create table candidate_projects (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,

  name        text not null,
  description text,

  project_url    text,
  repository_url text,

  start_year  int,
  start_month int,
  end_year    int,
  end_month   int,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cproj_start_month_range check (start_month is null or start_month between 1 and 12),
  constraint cproj_end_month_range   check (end_month   is null or end_month   between 1 and 12),
  constraint cproj_ordered check (
    start_year is null or end_year is null
    or end_year > start_year
    or (end_year = start_year and coalesce(end_month,12) >= coalesce(start_month,1))
  )
);
create index candidate_projects_sort_order_idx on candidate_projects (candidate_id, sort_order);

create table candidate_languages (
  candidate_id  uuid not null references candidates (id) on delete cascade,
  language_code text not null references languages (code),

  proficiency language_proficiency not null,
  sort_order  int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (candidate_id, language_code)
);
create index candidate_languages_language_idx   on candidate_languages (language_code, candidate_id);
create index candidate_languages_sort_order_idx on candidate_languages (candidate_id, sort_order);

create table candidate_profile_chunks (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,

  chunk_type  text,
  chunk_text  text not null,
  chunk_index int not null,

  embedding       vector(768),
  embedding_model text not null,

  created_at timestamptz not null default now(),

  unique (candidate_id, chunk_index)
);
create index candidate_profile_chunks_embedding_hnsw
  on candidate_profile_chunks using hnsw (embedding vector_cosine_ops);

create table candidate_embedding_jobs (
  candidate_id uuid primary key references candidates (id) on delete cascade,

  dirty    boolean not null default true,  -- set by trigger on any profile change
  revision bigint  not null default 1,     -- bumped each change; detects edits during embedding

  claimed_at    timestamptz,               -- visibility: NULL = not in-flight
  attempts      int not null default 0 constraint cej_attempts_nonneg check (attempts >= 0),
  error_message text,

  updated_at timestamptz not null default now()
);
create index candidate_embedding_jobs_claim_idx on candidate_embedding_jobs (updated_at) where dirty;
-- The sweep, which is a different question from the claim: in-flight jobs whose worker stopped
-- answering, oldest claim first. It reads `claimed_at`, which the index above does not carry, so
-- it sequentially scanned a table holding one permanent row per Candidate. Partial on the column
-- it also orders by, and only in-flight rows have a `claimed_at` at all.
create index candidate_embedding_jobs_stuck_idx on candidate_embedding_jobs (claimed_at)
  where claimed_at is not null;
