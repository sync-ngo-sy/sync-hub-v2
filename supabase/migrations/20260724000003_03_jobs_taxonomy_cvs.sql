create table languages (
  code text primary key,  -- ISO 639-1
  name text not null unique
);

-- Every place a Job or a Candidate can be, as a closed list: filtering by place is an equality
-- on `key`, never a substring, so Damascus and Rif Dimashq can no longer match each other.
-- Syria is resolved to the governorate and no finer; everywhere else is its country.
create table locations (
  key  text primary key,       -- 'sy-aleppo', 'lb'
  name text not null unique,   -- what a picker shows, so no two rows may share one
  kind location_kind not null
);

create table skill_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table skill_taxonomy (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references skill_categories (id),
  canonical_name text not null unique,
  created_at     timestamptz not null default now()
);
create index skill_taxonomy_category_id_idx on skill_taxonomy (category_id);

create table jobs (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants (id),
  created_by_recruiter_id uuid not null,

  title       text not null,
  description text not null,

  location_key    text references locations (key),
  employment_type text,
  minimum_total_experience_years numeric(4,1)
    constraint jobs_min_experience_nonneg
    check (minimum_total_experience_years is null or minimum_total_experience_years >= 0),

  status     job_status not null default 'draft',
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (tenant_id, created_by_recruiter_id) references recruiters (tenant_id, id),
  unique (tenant_id, id)
);
create index jobs_location_key_idx     on jobs (location_key);
create index jobs_tenant_status_idx    on jobs (tenant_id, status);
create index jobs_created_by_idx        on jobs (created_by_recruiter_id);
create index jobs_status_expires_at_idx on jobs (status, expires_at);

create table job_skills (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs (id) on delete cascade,
  taxonomy_id uuid not null references skill_taxonomy (id),

  importance    skill_importance not null default 'preferred',
  minimum_years int constraint job_skills_min_years_nonneg
                    check (minimum_years is null or minimum_years >= 0),

  created_at timestamptz not null default now(),

  unique (job_id, taxonomy_id)
);
create index job_skills_taxonomy_id_idx on job_skills (taxonomy_id);

create table job_languages (
  job_id        uuid not null references jobs (id) on delete cascade,
  language_code text not null references languages (code),

  minimum_proficiency language_proficiency not null,

  primary key (job_id, language_code)
);
create index job_languages_language_code_idx on job_languages (language_code);

create table job_application_questions (
  id     uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,

  question_text text not null,
  question_type application_question_type not null,
  is_required   boolean not null default true,

  accepted_boolean_answer boolean,

  sort_order int not null default 0 constraint jaq_sort_order_nonneg check (sort_order >= 0),
  created_at timestamptz not null default now(),

  constraint jaq_boolean_answer_only_for_yes_no
    check (question_type = 'yes_no' or accepted_boolean_answer is null),

  unique (job_id, id)
);
create index jaq_job_sort_order_idx on job_application_questions (job_id, sort_order);

create table cvs (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,

  display_name text not null,
  storage_path text not null,
  file_hash    text not null,          -- SHA-256 hex

  detected_language text,

  parsed_cv_schema_version int not null default 1,
  parsed_cv_data           jsonb,

  parsing_status cv_parsing_status not null default 'uploaded',
  parsing_error  text,
  parsed_at      timestamptz,

  created_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (candidate_id, id)
);
-- Partial, so the same file can be re-uploaded after a soft-delete.
create unique index cvs_candidate_file_hash_active_uidx
  on cvs (candidate_id, file_hash) where deleted_at is null;
create index cvs_candidate_parsing_status_idx on cvs (candidate_id, parsing_status);

create table ingestion_jobs (
  id     uuid primary key default gen_random_uuid(),
  cv_id  uuid not null unique references cvs (id) on delete cascade,

  status   ingestion_status not null default 'pending',
  attempts int not null default 0 constraint ingestion_jobs_attempts_nonneg check (attempts >= 0),

  error_message text,

  available_at timestamptz,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index ingestion_jobs_claim_idx on ingestion_jobs (available_at)
  where status in ('pending', 'processing');

alter table candidates
  add constraint candidates_preferred_language_fk
  foreign key (preferred_language_code) references languages (code);
create index candidates_preferred_language_idx on candidates (preferred_language_code);

alter table candidates
  add constraint candidates_location_fk
  foreign key (location_key) references locations (key);
create index candidates_location_key_idx on candidates (location_key);

alter table candidates
  add constraint candidates_current_cv_fk
  foreign key (id, current_cv_id) references cvs (candidate_id, id) on delete restrict;
