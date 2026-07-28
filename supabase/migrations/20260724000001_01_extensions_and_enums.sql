create extension if not exists vector with schema extensions;
create extension if not exists moddatetime with schema extensions;

create type account_type as enum ('candidate', 'recruiter');

create type recruiter_role as enum ('admin', 'recruiter');
create type tenant_plan   as enum ('free', 'pro', 'enterprise');
create type job_status    as enum ('draft', 'published', 'closed', 'archived');

create type skill_importance   as enum ('required', 'preferred', 'optional');
create type cv_parsing_status  as enum ('uploaded', 'processing', 'ready', 'failed');
create type ingestion_status   as enum ('pending', 'processing', 'completed', 'failed');

create type application_status as enum (
  'new', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'
);
create type application_question_type as enum ('yes_no', 'short_text');
create type status_change_source     as enum ('recruiter', 'candidate', 'system');
create type qualification_status     as enum ('pending', 'qualified', 'disqualified', 'review_required');

create type communication_channel as enum ('email', 'sms');
create type communication_status  as enum ('queued', 'processing', 'sent', 'failed');
-- A status change and a failed CV parse are Notifications (migration 12), not email.
create type communication_type    as enum (
  'application_confirmation', 'application_rejection', 'recruiter_message'
);

create type language_proficiency as enum ('beginner', 'intermediate', 'advanced', 'fluent', 'native');
create type tag_scope            as enum ('candidate', 'application');
