-- All trigger functions are SECURITY INVOKER (the default). Triggers fire for the service
-- role, unlike RLS — so the criteria lock below holds even against the trusted backend.

create trigger set_updated_at before update on profiles
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidates
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on jobs
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_experiences
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_educations
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_skills
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_projects
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_languages
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on applications
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on notes
  for each row execute function extensions.moddatetime(updated_at);

create function enqueue_candidate_reembed() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cid uuid;
begin
  if tg_table_name in ('candidates', 'profiles') then
    cid := coalesce(new.id, old.id);
  else
    cid := coalesce(new.candidate_id, old.candidate_id);
  end if;

  insert into public.candidate_embedding_jobs (candidate_id, dirty, revision, updated_at)
    values (cid, true, 1, now())
  on conflict (candidate_id) do update
    set dirty      = true,
        revision   = candidate_embedding_jobs.revision + 1,
        updated_at = now();

  return null;  -- AFTER trigger
end;
$$;

create trigger reembed_on_change after insert or update on candidates
  for each row execute function enqueue_candidate_reembed();

create trigger reembed_on_rename after update of full_name on profiles
  for each row
  when (new.account_type = 'candidate' and new.full_name is distinct from old.full_name)
  execute function enqueue_candidate_reembed();
create trigger reembed_on_change after insert or update or delete on candidate_experiences
  for each row execute function enqueue_candidate_reembed();
create trigger reembed_on_change after insert or update or delete on candidate_educations
  for each row execute function enqueue_candidate_reembed();
create trigger reembed_on_change after insert or update or delete on candidate_skills
  for each row execute function enqueue_candidate_reembed();
create trigger reembed_on_change after insert or update or delete on candidate_projects
  for each row execute function enqueue_candidate_reembed();
create trigger reembed_on_change after insert or update or delete on candidate_languages
  for each row execute function enqueue_candidate_reembed();

create function enqueue_cv_ingestion() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.ingestion_jobs (cv_id, status, available_at)
    values (new.id, 'pending', now());
  return null;  -- AFTER trigger
end;
$$;

create trigger ingest_on_upload after insert on cvs
  for each row execute function enqueue_cv_ingestion();

-- Every Application is read against its Job as it arrives, and nobody has to press anything for
-- it. Enqueued here rather than by the backend for the same reason a CV is: the queue row then
-- exists for every Application however it was written, and it is committed by the very
-- transaction that made the Application -- so an Application can never be visible with no
-- reading on the way.
create function enqueue_match_assessment() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.match_assessment_jobs (application_id, status, available_at)
    values (new.id, 'pending', now());
  return null;  -- AFTER trigger
end;
$$;

create trigger assess_on_arrival after insert on applications
  for each row execute function enqueue_match_assessment();

-- The Current assessment follows the readings rather than being aimed by whoever wrote one: the
-- worker's automatic reading and a Recruiter asking for another both land as an ordinary insert,
-- and both repoint the Application here. History stays append-only either way -- this moves a
-- pointer, and never a word of what an earlier model said.
create function point_at_the_current_assessment() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.applications
     set current_match_assessment_id = new.id,
         current_match_score         = new.match_percentage
   where id = new.application_id;
  return null;  -- AFTER trigger
end;
$$;

create trigger point_at_the_current_assessment
  after insert on application_ai_match_assessments
  for each row execute function point_at_the_current_assessment();

-- Throwing the Current assessment away falls back to the newest reading left, and to no reading
-- at all when it was the last one. Without this the composite FK would simply refuse the
-- deletion, and a Recruiter would be unable to discard the one reading they most want gone.
create function repoint_the_current_assessment() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining public.application_ai_match_assessments%rowtype;
begin
  select * into remaining
    from public.application_ai_match_assessments
   where application_id = old.application_id and id <> old.id
   order by created_at desc, id desc
   limit 1;

  -- No row found leaves every field of `remaining` null, which is exactly the answer when the
  -- reading being deleted was the only one. The `current_match_assessment_id` test is what keeps
  -- this to the deletion that actually moves the pointer.
  update public.applications
     set current_match_assessment_id = remaining.id,
         current_match_score         = remaining.match_percentage
   where id = old.application_id
     and current_match_assessment_id = old.id;
  return old;
end;
$$;

create trigger repoint_the_current_assessment
  before delete on application_ai_match_assessments
  for each row execute function repoint_the_current_assessment();

-- A candidate's current CV is the one they apply and are found with, so a deleted CV is never
-- it. Both directions are refused: deleting the CV that is current, and making a CV that is
-- already deleted current.
create function forbid_deleting_current_cv() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_cv uuid;
begin
  -- FOR UPDATE, because switching the current CV locks the same candidate row: the two
  -- cannot interleave into a candidate whose current CV has just been deleted.
  select c.current_cv_id into current_cv
    from public.candidates c where c.id = new.candidate_id for update;
  if current_cv = new.id then
    raise exception 'cv % is the current CV of candidate %', new.id, new.candidate_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger forbid_deleting_current_cv before update of deleted_at on cvs
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function forbid_deleting_current_cv();

create function forbid_deleted_current_cv() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cvs
    where id = new.current_cv_id and candidate_id = new.id and deleted_at is not null
  ) then
    raise exception 'cv % is deleted and cannot be the current CV of candidate %',
      new.current_cv_id, new.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger forbid_deleted_current_cv before update of current_cv_id on candidates
  for each row when (new.current_cv_id is not null)
  execute function forbid_deleted_current_cv();

create function forbid_searchable_without_a_readable_cv() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cvs
    where id = new.current_cv_id
      and candidate_id = new.id
      and parsing_status = 'ready'
      and deleted_at is null
  ) then
    raise exception 'candidate % cannot be searchable: their current CV has not been read',
      new.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger forbid_searchable_without_a_readable_cv
  before insert or update of is_searchable, current_cv_id on candidates
  for each row when (new.is_searchable)
  execute function forbid_searchable_without_a_readable_cv();

create function refuse_an_unearned_completion() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claims   public.candidates;
  identity public.profiles;
begin
  select * into claims from public.candidates where id = new.id;
  if not found or claims.profile_completed_at is null then
    return null;
  end if;

  select * into identity from public.profiles where id = claims.id;
  if btrim(identity.full_name) = '' then
    raise exception 'candidate % is not complete: it has no name', claims.id
      using errcode = 'check_violation';
  end if;
  if identity.phone is null or identity.phone_country is null then
    raise exception 'candidate % is not complete: it has no phone', claims.id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.cvs
    where id = claims.current_cv_id and candidate_id = claims.id
      and parsing_status = 'ready' and deleted_at is null
  ) then
    raise exception 'candidate % is not complete: no CV of theirs has been read', claims.id
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.candidate_educations where candidate_id = claims.id)
    or not exists (select 1 from public.candidate_skills     where candidate_id = claims.id)
    or not exists (select 1 from public.candidate_languages  where candidate_id = claims.id)
  then
    raise exception 'candidate % is not complete: a required section is empty', claims.id
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger refuse_an_unearned_completion
  after insert or update on candidates
  deferrable initially deferred
  for each row when (new.profile_completed_at is not null)
  execute function refuse_an_unearned_completion();

-- A Snapshot is the frozen profile an Application was judged from, and the two histories are
-- the record of what was decided and when. All of it was guarded by convention only, which is
-- no guard at all against this platform's own backend: it holds the service role, so RLS does
-- not apply to it. A trigger does — it fires for the service role like anybody else.
--
-- Inserts are untouched: a Snapshot is written once, and each hop of the pipeline appends.
create function forbid_rewriting_history() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is written once and never rewritten: % refused', tg_table_name, tg_op
    using errcode = 'check_violation';
end;
$$;

create trigger written_once before update or delete on application_profile_snapshots
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_experiences
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_educations
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_skills
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_languages
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_projects
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_answers
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_qualification_history
  for each row execute function forbid_rewriting_history();
create trigger written_once before update or delete on application_status_history
  for each row execute function forbid_rewriting_history();

create function forbid_locked_job_criteria() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jid uuid;
begin
  jid := coalesce(new.job_id, old.job_id);
  if exists (select 1 from public.applications where job_id = jid) then
    raise exception 'job criteria are locked: job % already has applications', jid
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lock_criteria before insert or update or delete on job_skills
  for each row execute function forbid_locked_job_criteria();
create trigger lock_criteria before insert or update or delete on job_languages
  for each row execute function forbid_locked_job_criteria();
create trigger lock_criteria before insert or update or delete on job_application_questions
  for each row execute function forbid_locked_job_criteria();

create function forbid_locked_job_min_experience() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.minimum_total_experience_years is distinct from old.minimum_total_experience_years
     and exists (select 1 from public.applications where job_id = new.id) then
    raise exception 'minimum_total_experience_years is locked: job % already has applications', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger lock_min_experience before update on jobs
  for each row execute function forbid_locked_job_min_experience();
