-- A Notification is in-app only; an externally delivered message is a Communication
-- (migration 06). Adding a producer means: a new enum value, a member of the payload union
-- in `sync_core.notifications`, and the code that writes it.

create type notification_type as enum (
  'cv_parse_failed',
  'cv_parse_succeeded',
  'application_stage_changed'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),

  recipient_profile_id uuid not null references profiles (id) on delete cascade,

  type    notification_type not null,
  payload jsonb            not null,

  application_id uuid,

  -- The Telling, on the bell's side: a Notification is not the Candidate's to read until this
  -- moment. Only a rejection sets one, from `applications.told_at`, and the three days it
  -- names are why the bell is silent while the Recruiter's list has already cleared. Null on
  -- everything told at once. A rejection taken back before it comes deletes the row rather
  -- than moving it: a Notification nobody could see never happened.
  visible_at timestamptz,

  read_at    timestamptz,
  created_at timestamptz not null default now(),

  foreign key (application_id, recipient_profile_id)
    references applications (id, candidate_id) on delete cascade,

  constraint notifications_payload_type_matches check (payload ->> 'type' = type::text),

  constraint notifications_stage_change_has_an_application check (
    type::text <> 'application_stage_changed' or application_id is not null
  )
);

create index notifications_recipient_created_idx
  on notifications (recipient_profile_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
  on notifications (recipient_profile_id) where read_at is null;

create index notifications_application_idx on notifications (application_id);

alter table notifications enable row level security;
