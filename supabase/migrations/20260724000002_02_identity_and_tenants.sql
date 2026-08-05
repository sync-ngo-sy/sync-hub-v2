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

  canonical_role_key text,  -- FK to canonical_roles(key) added in migration 03

  -- Derived from the experience entries on every profile save and never typed, so there is no
  -- state where this and the jobs it came from disagree. Whole years: a Recruiter asks for
  -- three years of work, not for 38 months.
  total_experience_years int not null default 0
    constraint candidates_total_experience_nonneg check (total_experience_years >= 0),

  unmapped_skills text[] not null default '{}',

  preferred_language_code text,  -- FK to languages(code) added in migration 03

  is_searchable boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  foreign key (id, account_type) references profiles (id, account_type) on delete cascade,
  constraint candidates_searchable_needs_cv check (not is_searchable or current_cv_id is not null),

  -- Bounded because both feed `candidates.search_vector` (migration 08), and a tsvector has a
  -- hard ceiling of its own: past about a megabyte of text, building one raises rather than
  -- truncating, so an unbounded column here would turn "save my profile" into a 500. The numbers
  -- are the API's own `Line` and `Paragraph` caps (`sync_core.profile`), restated where the row
  -- is written so no writer can get past them.
  constraint candidates_headline_length check (length(headline) <= 200),
  constraint candidates_summary_length  check (length(summary)  <= 5000)
);

create index candidates_current_cv_id_idx on candidates (current_cv_id);
-- A seniority bar is asked for as a range over every Candidate, not read off one row.
create index candidates_total_experience_idx on candidates (total_experience_years);
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

-- Nobody creates their own Tenant: a company asks for access here, and a Platform admin turns the
-- ask into a Tenant or dismisses it. The only row on the platform an unauthenticated stranger may
-- write, so it holds nothing but what a visitor typed and carries no identity — an Access request
-- is not an account, and converting one is what creates the Profile.
create table access_requests (
  id uuid primary key default gen_random_uuid(),

  company   text not null,
  full_name text not null,
  email     text not null,

  status access_request_status not null default 'pending',

  -- What the request became. Kept so a converted request still names its Tenant; nulled rather
  -- than deleted if that Tenant ever goes, because the request itself stays part of the record.
  tenant_id uuid references tenants (id) on delete set null,

  created_at timestamptz not null default now(),
  decided_at timestamptz,

  -- A converted request is not required to still *have* its Tenant: the FK above nulls this
  -- column when a Tenant is deleted, and insisting on it here would make every
  -- `delete from tenants` a constraint violation — no Tenant opened by mistake could ever be
  -- removed. `decided_at` is what separates a decided request from a waiting one, and only
  -- `dismissed` is held to naming no Tenant at all.
  constraint access_requests_decision check (
    case status
      when 'pending'   then decided_at is null     and tenant_id is null
      when 'dismissed' then decided_at is not null and tenant_id is null
      when 'converted' then decided_at is not null
    end
  ),

  -- The three columns hold nothing but what a stranger typed, and `not null` is no guard against
  -- a stranger: a space is a value. The company is what the Tenant gets *called* on conversion
  -- and the name is who gets invited, so an empty one is a queue row an operator cannot act on.
  -- The API refuses all three already; this is the same refusal where the row is written, which
  -- is the only place a future writer of this table cannot forget it.
  constraint access_requests_company_not_blank   check (btrim(company)   <> ''),
  constraint access_requests_full_name_not_blank check (btrim(full_name) <> ''),
  -- Shape, not deliverability — no schema can know whether an address exists. Enough to refuse
  -- whitespace, an address with no domain, and one with spaces in the middle.
  constraint access_requests_email_shape check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

-- The queue: pending requests, oldest first.
create index access_requests_pending_idx on access_requests (created_at)
  where status = 'pending';

-- Asking twice is asking once. Only while pending — a company dismissed a year ago may ask again,
-- and one already converted has a Tenant to sign in to.
--
-- On `lower(email)`, because an address is the same address whatever it is typed in, and two
-- pending rows for one company is exactly what an operator working this queue must not see. The
-- backend lowercases before writing, so this closes the gap for anything that does not.
create unique index access_requests_one_pending_per_email_idx on access_requests (lower(email))
  where status = 'pending';

-- The one foreign key in the schema that had no index behind it. Nothing reads Access requests by
-- Tenant; what needs it is `delete from tenants`, which has to prove no request points at the row
-- it is removing and could only do that by scanning.
create index access_requests_tenant_id_idx on access_requests (tenant_id);
