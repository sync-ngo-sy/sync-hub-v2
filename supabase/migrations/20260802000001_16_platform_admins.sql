-- The operator account that runs the platform: no Tenant, and no candidate profile. It joins
-- candidates and recruiters on the shared-PK pattern of migration 02 — a constant account_type
-- pinned by CHECK, referencing profiles (id, account_type) — so a Profile is still exactly one
-- of the three, structurally, and every existing constraint keeps the meaning it had.
--
-- Distinct from a Recruiter whose `role` is `admin`: that is a role inside one Tenant, this is
-- an account outside every Tenant.
--
-- The first row cannot be seeded here: the auth user and its password belong to the identity
-- provider, not to this schema. `scripts/create_platform_admin.py` in services/api makes one.

create table platform_admins (
  id           uuid primary key,
  account_type account_type not null default 'platform_admin'
    check (account_type = 'platform_admin'),

  created_at timestamptz not null default now(),

  foreign key (id, account_type) references profiles (id, account_type) on delete cascade
);

alter table platform_admins enable row level security;
