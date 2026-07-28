-- A Message template is a Tenant's reusable subject/body with placeholders, rendered into one
-- concrete Communication when a Recruiter messages an applicant. The placeholder vocabulary is
-- the backend's (`sync_api.messaging.placeholders`) and validated at save time: the database
-- stores the text a recruiter wrote, and nothing here parses it.
--
-- What the recruiter's message becomes lives in `communications` already — migration 06 gave it
-- `initiated_by_recruiter_id` with the CHECKs and composite FKs that make a recruiter-initiated
-- row require an Application of that recruiter's own Tenant. The rendered subject and body are
-- audited in that row's `payload`, so a template edited or deleted later cannot change what a
-- Candidate was actually sent.

create table message_templates (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants (id),
  created_by_recruiter_id uuid not null,

  name    text not null,
  subject text not null,
  body    text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (tenant_id, created_by_recruiter_id) references recruiters (tenant_id, id),

  unique (tenant_id, name)
);

-- `unique (tenant_id, name)` is the index the listing reads in order; this one is for the
-- recruiter side of the pair, the way every other tenant table indexes its author.
create index message_templates_created_by_idx on message_templates (created_by_recruiter_id);

create trigger set_updated_at before update on message_templates
  for each row execute function extensions.moddatetime(updated_at);

alter table message_templates enable row level security;
