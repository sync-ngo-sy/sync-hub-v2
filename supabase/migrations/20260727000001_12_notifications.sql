-- A Notification is in-app only; an externally delivered message is a Communication
-- (migration 06). Adding a producer means: a new enum value, a member of the payload union
-- in `sync_core.notifications`, and the code that writes it.

create type notification_type as enum (
  'cv_parse_failed'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),

  recipient_profile_id uuid not null references profiles (id) on delete cascade,

  type    notification_type not null,
  payload jsonb            not null,

  application_id uuid,

  read_at    timestamptz,
  created_at timestamptz not null default now(),

  foreign key (application_id, recipient_profile_id)
    references applications (id, candidate_id) on delete cascade,

  constraint notifications_payload_type_matches check (payload ->> 'type' = type::text),

  -- A move is a move *of an Application*, and `application_id` is the column every reader of this
  -- table joins and filters on. It was nullable because a `cv_parse_failed` Notification is about
  -- a CV and names none — so the column stays nullable, and the one type that cannot mean
  -- anything without it is held to carrying it.
  --
  -- Compared as text, like the constraint above it, because `application_status_changed` is not a
  -- value of this enum yet: migration 14 adds it. An enum literal here would be a value Postgres
  -- cannot resolve at the moment this table is created.
  constraint notifications_status_change_has_an_application check (
    type::text <> 'application_status_changed' or application_id is not null
  )
);

create index notifications_recipient_created_idx
  on notifications (recipient_profile_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
  on notifications (recipient_profile_id) where read_at is null;

create index notifications_application_idx on notifications (application_id);

alter table notifications enable row level security;
