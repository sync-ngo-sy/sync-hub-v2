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

  -- The Telling: the moment this Application's rejection reaches the Candidate, three days
  -- after the Tenant took it. Deciding and telling are two moments rather than one, and this
  -- one column holds all three channels to the same day -- the Stage projection reads it,
  -- `notifications.visible_at` is set from it, and so is `communications.available_at`. Only a
  -- rejection has one; a hire and a withdrawal are told at once. Three days is one
  -- platform-wide number, never a Tenant's to set. A cancelled Telling is cleared back to
  -- null. It is not constrained against `status`, and cannot be: a Telling the Candidate
  -- reached outlives its rejection, so a `reviewing` row carrying one is the record of a
  -- Candidate who was told, and the projection honours it only while the status is `rejected`.
  told_at timestamptz,

  -- The Match score: the percentage the Application's reading gave, kept here as well as on the
  -- reading itself. A Job's list orders hundreds of rows by it, and an order can only be indexed
  -- on a column of the table it orders. Never written by hand -- the trigger in migration 07
  -- moves it whenever the reading lands or changes -- and null until the Application has been
  -- read at all.
  current_match_score numeric(5,2)
    constraint applications_current_match_score_range check (current_match_score between 0 and 100),

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

  -- The Links travel with the Application, like every other thing the Candidate was reviewed on,
  -- and in the same shape the live columns hold: a Snapshot cannot contain something a profile
  -- could not.
  linkedin_url  text,
  github_url    text,
  portfolio_url text,

  captured_at timestamptz not null default now(),

  constraint asnap_phone_is_e164 check (phone ~ '^\+[1-9][0-9]{1,14}$'),
  constraint asnap_phone_has_a_country check (num_nonnulls(phone, phone_country) <> 1),
  constraint asnap_phone_country_is_iso check (phone_country ~ '^[A-Z]{2}$'),

  constraint asnap_linkedin_url_shape check (
    linkedin_url is null
    or (linkedin_url like 'https://www.linkedin.com/in/%' and length(linkedin_url) <= 2000)
  ),
  constraint asnap_github_url_shape check (
    github_url is null
    or (github_url like 'https://github.com/%' and length(github_url) <= 2000)
  ),
  constraint asnap_portfolio_url_shape check (
    portfolio_url is null
    or ((portfolio_url like 'http://%' or portfolio_url like 'https://%')
        and length(portfolio_url) <= 2000)
  )
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

-- One reading per Application, and the schema holds it to that rather than the backend: asking
-- for another replaces the one there. A Recruiter who distrusts a reading asks again; nobody
-- deletes one, so an Application that has been read never stops carrying a Match score.
--
-- `model_name` and `prompt_version` stay on the row. The reading being the only one does not
-- make its provenance less interesting: it is what says whether the number in front of a
-- Recruiter was written by today's model under today's instructions.
create table application_ai_match_assessments (
  id uuid primary key default gen_random_uuid(),

  application_id  uuid not null unique references applications (id) on delete cascade,
  match_percentage numeric(5,2) not null
    constraint aima_percentage_range check (match_percentage between 0 and 100),
  explanation        text,
  assessment_details jsonb,

  model_name     text not null,
  prompt_version text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- What a Job's triage list sorts hundreds of rows by. `coalesce` rather than `nulls last`
-- because the same expression has to serve both directions from one index, and an Application
-- nobody has read yet has no score to place among the ones that do: -1 puts it below every
-- real percentage, which reads as "not assessed" at the bottom of the best-first list and at
-- the top of the worst-first one. The id breaks ties, of which a percentage has many.
create index applications_job_match_score_idx
  on applications (job_id, (coalesce(current_match_score, -1)) desc, id desc);
-- The tenant-wide twin, for the same reason `applications_tenant_applied_at_idx` exists: no
-- index leading with `tenant_id` can serve an order the per-Job one covers.
create index applications_tenant_match_score_idx
  on applications (tenant_id, (coalesce(current_match_score, -1)) desc, id desc);

-- Every Application is read as it arrives, and the reading happens in the worker rather than in
-- the request that created it: a model takes seconds a Candidate should not spend watching a
-- spinner, and a provider that is down must not be able to refuse an Application.
--
-- Shaped exactly like `ingestion_jobs`, because the same queue engine drains it. One row per
-- Application -- the automatic reading. A Recruiter asking for another does it through the API,
-- which answers with the reading it just made.
create table match_assessment_jobs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications (id) on delete cascade,

  status   assessment_status not null default 'pending',
  attempts int not null default 0 constraint maj_attempts_nonneg check (attempts >= 0),

  error_message text,

  available_at timestamptz,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index match_assessment_jobs_claim_idx on match_assessment_jobs (available_at)
  where status in ('pending', 'processing');
create index match_assessment_jobs_status_created_idx
  on match_assessment_jobs (status, created_at);
