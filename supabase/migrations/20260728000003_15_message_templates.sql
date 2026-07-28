-- A Tenant's reusable subject/body, rendered into one Communication when a Recruiter messages
-- an applicant. The placeholder vocabulary is the backend's and validated at save time; nothing
-- here parses the text. `communications` already carries the recruiter-initiated shape (migration
-- 06), and audits the resolved words in its own payload, so a template rewritten or deleted later
-- cannot change what a Candidate was sent.

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

-- `unique (tenant_id, name)` is already the index the listing reads in order.
create index message_templates_created_by_idx on message_templates (created_by_recruiter_id);

create trigger set_updated_at before update on message_templates
  for each row execute function extensions.moddatetime(updated_at);

alter table message_templates enable row level security;
