-- application_* rows are immutable once written. tenant_id is denormalized so tenant
-- isolation is a composite FK rather than RLS alone.

create table applications (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,

  candidate_id uuid not null references candidates (id),
  job_id       uuid not null,
  cv_id        uuid not null,
  tracked_link_id uuid,                  -- FK to tracked_job_links added in migration 06

  status               application_status  not null default 'new',
  qualification_status qualification_status not null default 'pending',
  qualification_reason text,

  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (tenant_id, job_id) references jobs (tenant_id, id),
  foreign key (candidate_id, cv_id) references cvs (candidate_id, id),

  unique (candidate_id, job_id),
  unique (job_id, id),
  unique (tenant_id, id),
  unique (id, candidate_id),

  constraint applications_disqualification_has_a_reason check (
    qualification_status <> 'disqualified' or qualification_reason is not null
  )
);
create index applications_job_status_idx       on applications (job_id, status);
create index applications_job_tracked_link_idx on applications (job_id, tracked_link_id);
create index applications_cv_id_idx            on applications (cv_id);
create index applications_job_applied_at_idx   on applications (job_id, applied_at desc, id desc);

-- The tenant-wide reads, which the per-Job indexes above cannot serve: the only other index
-- leading with `tenant_id` is the `(tenant_id, id)` unique constraint.
create index applications_tenant_applied_at_idx on applications (tenant_id, applied_at desc, id desc);
create index applications_tenant_status_idx     on applications (tenant_id, status);

create table application_profile_snapshots (
  application_id uuid primary key references applications (id) on delete cascade,

  full_name text not null,

  -- The Phone as it was the day the Application arrived, country and all: an Application is
  -- read long after the Candidate has moved countries, and half a frozen answer is not one.
  phone         text,
  phone_country text,

  headline  text,
  summary   text,

  -- `location` and `canonical_role` are frozen as the *names* they went by the day the
  -- Application arrived, never as their keys. Re-wording an entry in either vocabulary, or the
  -- Candidate moving or retraining afterwards, then leaves every Application already judged
  -- saying exactly what it said. A key would point into today's vocabulary, which is what the
  -- live profile is for; an Application is the record of a moment.
  location       text,
  canonical_role text,

  unmapped_skills text[] not null default '{}',

  -- The Candidate's Total experience as it stood the day they applied, copied rather than
  -- recomputed: a verdict reached today can be re-explained years later from the Snapshot
  -- alone, and Screening does no arithmetic over dates at all.
  total_experience_years int not null
    constraint asnap_total_experience_nonneg check (total_experience_years >= 0),

  captured_at timestamptz not null default now(),

  constraint asnap_phone_is_e164 check (phone ~ '^\+[1-9][0-9]{1,14}$'),
  constraint asnap_phone_country_is_iso check (phone_country ~ '^[A-Z]{2}$'),
  constraint asnap_phone_has_a_country check (num_nonnulls(phone, phone_country) <> 1)
);

create table application_experiences (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,

  company_name text,
  job_title    text not null,

  -- Dated as strictly as the live entry it was frozen from: a Snapshot cannot contain something
  -- a profile could not.
  start_year  int not null,
  start_month int,
  end_year    int,
  end_month   int,

  is_current  boolean not null default false,
  description text,
  sort_order  int not null default 0,

  constraint aexp_finished_work_has_an_end check (is_current or end_year is not null),
  constraint aexp_start_month_range check (start_month is null or start_month between 1 and 12),
  constraint aexp_end_month_range   check (end_month   is null or end_month   between 1 and 12),
  constraint aexp_start_year_range  check (start_year  is null or start_year  between 1900 and 2100),
  constraint aexp_end_year_range    check (end_year    is null or end_year    between 1900 and 2100),
  constraint aexp_ordered check (
    start_year is null or end_year is null
    or end_year > start_year
    or (end_year = start_year and coalesce(end_month,12) >= coalesce(start_month,1))
  ),
  constraint aexp_current_has_no_end check (not is_current or (end_year is null and end_month is null))
);
create index application_experiences_start_year_idx on application_experiences (application_id, start_year);
create index application_experiences_sort_order_idx on application_experiences (application_id, sort_order);

create table application_educations (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,

  institution     text not null,
  degree          text,
  field_of_study  text,
  graduation_year int,

  description text,
  sort_order int not null default 0,

  constraint aedu_grad_year_range check (graduation_year is null or graduation_year between 1900 and 2100)
);
create index application_educations_grad_year_idx  on application_educations (application_id, graduation_year);
create index application_educations_sort_order_idx on application_educations (application_id, sort_order);

create table application_skills (
  application_id uuid not null references applications (id) on delete cascade,
  taxonomy_id    uuid not null references skill_taxonomy (id),

  years_experience numeric(4,1) not null
    constraint askill_years_nonneg check (years_experience >= 0),
  sort_order int not null default 0,

  primary key (application_id, taxonomy_id)
);
create index application_skills_taxonomy_idx   on application_skills (taxonomy_id, application_id);
create index application_skills_sort_order_idx on application_skills (application_id, sort_order);

create table application_projects (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,

  name        text not null,
  description text,

  project_url    text,
  repository_url text,

  start_year  int,
  start_month int,
  end_year    int,
  end_month   int,

  sort_order int not null default 0,

  constraint aproj_start_month_range check (start_month is null or start_month between 1 and 12),
  constraint aproj_end_month_range   check (end_month   is null or end_month   between 1 and 12),
  constraint aproj_ordered check (
    start_year is null or end_year is null
    or end_year > start_year
    or (end_year = start_year and coalesce(end_month,12) >= coalesce(start_month,1))
  )
);
create index application_projects_sort_order_idx on application_projects (application_id, sort_order);

create table application_languages (
  application_id uuid not null references applications (id) on delete cascade,
  language_code  text not null references languages (code),

  proficiency language_proficiency not null,
  sort_order  int not null default 0,

  primary key (application_id, language_code)
);
create index application_languages_language_idx   on application_languages (language_code, application_id);
create index application_languages_sort_order_idx on application_languages (application_id, sort_order);

create table application_answers (
  application_id uuid not null,
  job_id         uuid not null,
  question_id    uuid not null,

  answer_boolean boolean,
  answer_text    text,

  created_at timestamptz not null default now(),

  primary key (application_id, question_id),

  foreign key (job_id, application_id) references applications (job_id, id) on delete cascade,
  foreign key (job_id, question_id)   references job_application_questions (job_id, id),

  constraint aans_one_answer_kind check (
    (answer_boolean is not null and answer_text is null)
    or (answer_boolean is null and answer_text is not null)
  )
);
create index application_answers_job_question_idx on application_answers (job_id, question_id);

create table application_status_history (
  id uuid primary key default gen_random_uuid(),

  application_id        uuid not null references applications (id) on delete cascade,
  change_source         status_change_source not null,
  changed_by_profile_id uuid references profiles (id),

  previous_status application_status,
  new_status      application_status not null,

  reason     text,
  created_at timestamptz not null default now(),

  constraint ash_human_decision_has_an_author check (
    change_source = 'system' or changed_by_profile_id is not null
  )
);
create index application_status_history_app_created_idx on application_status_history (application_id, created_at);
create index application_status_history_changed_by_idx  on application_status_history (changed_by_profile_id);

create table application_qualification_history (
  id uuid primary key default gen_random_uuid(),

  application_id       uuid not null references applications (id) on delete cascade,
  qualification_status qualification_status not null,
  qualification_reason text,
  screening_version    text,

  created_at timestamptz not null default now(),

  constraint aqh_disqualification_has_a_reason check (
    qualification_status <> 'disqualified' or qualification_reason is not null
  )
);
create index application_qualification_history_app_created_idx
  on application_qualification_history (application_id, created_at);

create table application_ai_match_assessments (
  id uuid primary key default gen_random_uuid(),

  application_id  uuid not null references applications (id) on delete cascade,
  match_percentage numeric(5,2) not null
    constraint aima_percentage_range check (match_percentage between 0 and 100),
  explanation        text,
  assessment_details jsonb,

  model_name     text not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);
create index application_ai_match_assessments_app_created_idx
  on application_ai_match_assessments (application_id, created_at);
