create table tracked_job_links (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null,
  job_id                  uuid not null,
  created_by_recruiter_id uuid not null,

  name  text not null,
  token text not null unique,        -- unguessable token in the public URL

  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,

  foreign key (tenant_id, job_id)                references jobs (tenant_id, id),
  foreign key (tenant_id, created_by_recruiter_id) references recruiters (tenant_id, id),

  unique (tenant_id, job_id, name),
  unique (tenant_id, id),
  unique (job_id, id)
);
create index tracked_job_links_job_active_idx on tracked_job_links (job_id, is_active);
create index tracked_job_links_created_by_idx on tracked_job_links (created_by_recruiter_id);

alter table applications
  add constraint applications_tracked_link_fk
  foreign key (job_id, tracked_link_id) references tracked_job_links (job_id, id);

create table communications (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid,                              -- NULL only for platform messages

  candidate_id   uuid not null references candidates (id),
  application_id uuid,
  initiated_by_recruiter_id uuid,

  channel            communication_channel not null,
  communication_type communication_type    not null,
  status             communication_status  not null default 'queued',

  recipient text not null,
  subject   text,
  payload   jsonb not null,

  attempts      int not null default 0 constraint comm_attempts_nonneg check (attempts >= 0),
  error_message text,

  provider            text,
  provider_message_id text,

  template_key    text,
  idempotency_key text not null unique,

  created_at timestamptz not null default now(),
  sent_at    timestamptz,

  foreign key (tenant_id)                        references tenants (id),
  foreign key (application_id, candidate_id)      references applications (id, candidate_id),
  foreign key (tenant_id, application_id)         references applications (tenant_id, id),
  foreign key (tenant_id, initiated_by_recruiter_id) references recruiters (tenant_id, id),

  constraint comm_app_needs_tenant       check (application_id is null or tenant_id is not null),
  constraint comm_recruiter_needs_tenant check (initiated_by_recruiter_id is null or tenant_id is not null),
  constraint comm_recruiter_needs_app    check (initiated_by_recruiter_id is null or application_id is not null),
  constraint comm_platform_shape check (
    tenant_id is not null
    or (application_id is null and initiated_by_recruiter_id is null)
  )
);
create index communications_status_created_idx      on communications (status, created_at);
create index communications_candidate_idx           on communications (candidate_id);
create index communications_application_idx          on communications (application_id);
create index communications_tenant_candidate_idx    on communications (tenant_id, candidate_id, created_at);
create index communications_tenant_application_idx   on communications (tenant_id, application_id, created_at);
create index communications_tenant_recruiter_idx     on communications (tenant_id, initiated_by_recruiter_id);
create unique index communications_provider_msg_uidx on communications (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;

create table job_view_events (
  id     bigint generated always as identity primary key,
  job_id uuid not null references jobs (id) on delete cascade,

  tracked_link_id uuid,
  session_id      text,
  visitor_hash    text,

  viewed_at timestamptz not null default now(),

  foreign key (job_id, tracked_link_id) references tracked_job_links (job_id, id)
);
create index job_view_events_job_viewed_idx         on job_view_events (job_id, viewed_at);
create index job_view_events_link_viewed_idx        on job_view_events (tracked_link_id, viewed_at);
create index job_view_events_job_link_viewed_idx    on job_view_events (job_id, tracked_link_id, viewed_at);

create table notes (
  id uuid primary key default gen_random_uuid(),

  tenant_id      uuid not null references tenants (id),
  application_id uuid,
  candidate_id   uuid references candidates (id),
  recruiter_id   uuid not null,

  note_text text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (tenant_id, application_id) references applications (tenant_id, id) on delete cascade,
  foreign key (tenant_id, recruiter_id)   references recruiters (tenant_id, id),

  -- Exactly one subject, so each keeps a real FK and its own delete rule.
  constraint notes_one_subject check (num_nonnulls(application_id, candidate_id) = 1)
);
create index notes_application_created_idx on notes (application_id, created_at desc, id desc)
  where application_id is not null;
create index notes_tenant_candidate_created_idx
  on notes (tenant_id, candidate_id, created_at desc, id desc) where candidate_id is not null;
create index notes_candidate_idx        on notes (candidate_id) where candidate_id is not null;
create index notes_tenant_recruiter_idx on notes (tenant_id, recruiter_id);

create table tenant_tags (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),

  name  text not null,
  scope tag_scope not null,

  created_at timestamptz not null default now(),

  unique (tenant_id, scope, name),
  unique (tenant_id, id),
  unique (id, scope)
);

create table candidate_tag_assignments (
  tenant_id    uuid not null,
  candidate_id uuid not null references candidates (id),
  tag_id       uuid not null,
  scope        tag_scope not null default 'candidate' check (scope = 'candidate'),

  added_by_recruiter_id uuid not null,
  created_at timestamptz not null default now(),

  primary key (candidate_id, tag_id),

  foreign key (tenant_id, tag_id)               references tenant_tags (tenant_id, id) on delete cascade,
  foreign key (tag_id, scope)                   references tenant_tags (id, scope) on delete cascade,
  foreign key (tenant_id, added_by_recruiter_id) references recruiters (tenant_id, id)
);
create index candidate_tag_assignments_tenant_candidate_idx on candidate_tag_assignments (tenant_id, candidate_id);
create index candidate_tag_assignments_tag_idx             on candidate_tag_assignments (tag_id);
create index candidate_tag_assignments_added_by_idx        on candidate_tag_assignments (added_by_recruiter_id);

create table application_tag_assignments (
  tenant_id      uuid not null,
  application_id uuid not null,
  tag_id         uuid not null,
  scope          tag_scope not null default 'application' check (scope = 'application'),

  added_by_recruiter_id uuid not null,
  created_at timestamptz not null default now(),

  primary key (application_id, tag_id),

  foreign key (tenant_id, application_id)        references applications (tenant_id, id) on delete cascade,
  foreign key (tenant_id, tag_id)                references tenant_tags (tenant_id, id) on delete cascade,
  foreign key (tag_id, scope)                    references tenant_tags (id, scope) on delete cascade,
  foreign key (tenant_id, added_by_recruiter_id) references recruiters (tenant_id, id)
);
create index application_tag_assignments_tenant_app_idx on application_tag_assignments (tenant_id, application_id);
create index application_tag_assignments_tag_idx        on application_tag_assignments (tag_id);
create index application_tag_assignments_added_by_idx   on application_tag_assignments (added_by_recruiter_id);

create table talent_pool_members (
  tenant_id    uuid not null references tenants (id),
  candidate_id uuid not null references candidates (id),

  added_by_recruiter_id uuid not null,
  added_at timestamptz not null default now(),

  primary key (tenant_id, candidate_id),

  foreign key (tenant_id, added_by_recruiter_id) references recruiters (tenant_id, id)
);
create index talent_pool_members_tenant_added_idx on talent_pool_members (tenant_id, added_at desc, candidate_id desc);
create index talent_pool_members_candidate_idx    on talent_pool_members (candidate_id);
create index talent_pool_members_added_by_idx  on talent_pool_members (added_by_recruiter_id);
