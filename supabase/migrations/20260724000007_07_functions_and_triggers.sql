-- 07 · Functions and triggers
--
-- All trigger functions are SECURITY INVOKER (the default). Every application write goes
-- through the service role, which triggers still fire for (unlike RLS) — so the criteria-lock
-- protects the invariant even against the trusted backend.

-- updated_at auto-touch ------------------------------------------------------

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
create trigger set_updated_at before update on application_notes
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on candidate_notes
  for each row execute function extensions.moddatetime(updated_at);

-- Re-embed enqueue (coalesced, one pending job per candidate) -----------------

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

-- CV ingestion enqueue -------------------------------------------------------

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

-- Screening-criteria lock (guard #2) -----------------------------------------
-- Once a job has any application, its screening inputs are frozen.

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
