-- 12 · In-app notifications
--
-- A Notification is an in-app message to one Profile, carrying a typed payload and a
-- read/unread state (the glossary's term). Never delivered externally — that is a
-- Communication, which lives in migration 06 and has a queue behind it. A Notification has
-- none: it is written by the transaction whose outcome it announces, so a Candidate can
-- never be told about a state the platform did not actually reach.
--
-- The payload's shapes live in `sync_core.notifications` as a discriminated union on
-- `type`. Postgres cannot check the members, but it can check that the two halves agree —
-- see `notifications_payload_type_matches` — so a producer that writes one type's payload
-- under another type's name is refused here rather than crashing whatever reads it back.

create type notification_type as enum (
  'cv_parse_failed',            -- a CV the platform gave up on reading
  'application_status_changed'  -- a Recruiter moved an Application, or the Candidate withdrew
);

create table notifications (
  id uuid primary key default gen_random_uuid(),

  -- The addressee. A Profile rather than a Candidate: the column is what a bell icon reads,
  -- and nothing about "an in-app message to one human" is candidate-specific.
  recipient_profile_id uuid not null references profiles (id) on delete cascade,

  type    notification_type not null,
  payload jsonb            not null,

  -- What this is about, when it is about an Application. NULL for the notifications that
  -- are not — a failed CV parse, for one.
  application_id uuid,

  read_at    timestamptz,
  created_at timestamptz not null default now(),

  -- An Application's notifications go to the Candidate who applied, never to anyone else.
  -- The composite FK is what makes that structural rather than a rule the backend
  -- remembers: recipient and application cannot disagree about whose it is.
  foreign key (application_id, recipient_profile_id)
    references applications (id, candidate_id) on delete cascade,

  constraint notifications_payload_type_matches check (payload ->> 'type' = type::text)
);

-- The list endpoint's only query: this recipient's notifications, newest first, paged by
-- keyset on exactly this ordering. `id` breaks ties so two notifications written in the
-- same transaction cannot straddle a page boundary.
create index notifications_recipient_created_idx
  on notifications (recipient_profile_id, created_at desc, id desc);

-- The unread count, which a bell icon asks for far more often than it asks for the list.
create index notifications_recipient_unread_idx
  on notifications (recipient_profile_id) where read_at is null;

create index notifications_application_idx on notifications (application_id);

-- Migration 09's deny-by-default sweep has already run, so this table enables RLS itself.
-- No policies, exactly as everywhere else: the trusted backend is the only reader, and the
-- client roles get zero rows if they ever reach PostgREST. The `alter default privileges`
-- from that migration covers the grants for tables created afterwards.
alter table notifications enable row level security;
