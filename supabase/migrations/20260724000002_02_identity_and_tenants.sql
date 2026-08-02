-- Shared-PK identity (ADR supabase-0001): profiles.id = candidates.id = recruiters.id =
-- auth.users.id. The candidate-XOR-recruiter invariant is structural, not a backend rule:
-- profiles has UNIQUE (id, account_type), each child pins a constant account_type, and the
-- composite FK makes the opposite child row physically unreferenceable.

create table tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  plan       tenant_plan not null default 'free',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  account_type account_type not null,

  full_name  text not null,
  avatar_url text,
  phone      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (id, account_type)
);

create index profiles_active_idx on profiles (id) where deleted_at is null;

create table candidates (
  id           uuid primary key,
  account_type account_type not null default 'candidate' check (account_type = 'candidate'),

  current_cv_id uuid,  -- FK to cvs (candidate_id, id) added in migration 03

  headline text,
  summary  text,

  location_key text,  -- FK to locations(key) added in migration 03

  unmapped_skills text[] not null default '{}',

  preferred_language_code text,  -- FK to languages(code) added in migration 03

  is_searchable boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  foreign key (id, account_type) references profiles (id, account_type) on delete cascade,
  constraint candidates_searchable_needs_cv check (not is_searchable or current_cv_id is not null)
);

create index candidates_current_cv_id_idx on candidates (current_cv_id);
create index candidates_searchable_idx on candidates (id)
  where is_searchable and deleted_at is null;

create table recruiters (
  id           uuid primary key,
  account_type account_type not null default 'recruiter' check (account_type = 'recruiter'),

  tenant_id uuid not null references tenants (id),
  role      recruiter_role not null default 'recruiter',
  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  foreign key (id, account_type) references profiles (id, account_type) on delete cascade,
  unique (tenant_id, id)
);

create index recruiters_tenant_id_idx on recruiters (tenant_id);
