create extension if not exists vector with schema extensions;
create extension if not exists moddatetime with schema extensions;

create type account_type as enum ('candidate', 'recruiter', 'platform_admin');

create type recruiter_role as enum ('admin', 'recruiter');
create type tenant_plan   as enum ('free', 'pro', 'enterprise');
-- Where an Access request ends up. Sync is sold, not self-served, so a Tenant starts here.
create type access_request_status as enum ('pending', 'converted', 'dismissed');
create type job_status    as enum ('draft', 'published', 'closed', 'archived');

create type location_kind      as enum ('country', 'governorate');
create type skill_importance   as enum ('required', 'preferred', 'optional');

-- What the contract is, and where the work happens — two answers to two different questions.
-- Work mode is not a place: a remote Job still records the Location its team sits in.
create type employment_type as enum (
  'full_time', 'part_time', 'contract', 'temporary', 'internship', 'volunteer'
);
create type work_mode       as enum ('onsite', 'hybrid', 'remote');

create type cv_parsing_status  as enum ('uploaded', 'processing', 'ready', 'failed');
create type ingestion_status   as enum ('pending', 'processing', 'completed', 'failed');

create type application_status as enum (
  'new', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'
);
-- The queue that reads an Application against its Job as it arrives. Its own enum rather than
-- `ingestion_status`, so the two queues can be given different states without one moving the
-- other -- the same reason Communications has one of its own.
create type assessment_status as enum ('pending', 'processing', 'completed', 'failed');
create type application_question_type as enum ('yes_no', 'short_text');
create type status_change_source     as enum ('recruiter', 'candidate', 'system');
create type qualification_status     as enum ('pending', 'qualified', 'disqualified', 'review_required');
-- What the Candidate said about a hire their Tenant claims (migration 19). A claim arrives
-- unanswered and stays a claim until they answer; only `confirmed` makes it a Placement.
create type hire_confirmation as enum ('unanswered', 'confirmed', 'denied');

create type communication_channel as enum ('email', 'sms');
-- `cancelled` is the end of a message the platform decided not to send after all: a rejection
-- queued for a Telling that never came, because the Tenant took the decision back inside the
-- three days. The row stays, so what was nearly sent is still readable; the sender's claim
-- index does not see it.
create type communication_status  as enum ('queued', 'processing', 'sent', 'failed', 'cancelled');
-- A Stage change and a failed CV parse are Notifications (migration 12), not email.
create type communication_type    as enum (
  'application_confirmation', 'application_rejection', 'recruiter_message'
);

create type language_proficiency as enum ('beginner', 'intermediate', 'advanced', 'fluent', 'native');
create type tag_scope            as enum ('candidate', 'application');
