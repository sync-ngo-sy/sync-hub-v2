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
  if tg_table_name = 'candidates' then
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
