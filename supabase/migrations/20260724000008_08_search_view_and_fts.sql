-- security_invoker so base-table RLS still applies; revoked from client roles. Never
-- exposes email (not stored here) or phone.

create view candidate_search_profiles with (security_invoker = true) as
  select
    c.id as candidate_id,
    p.full_name,
    p.avatar_url,
    c.headline,
    c.summary,
    c.location_key,
    loc.name as location_name,
    c.preferred_language_code
  from candidates c
  join profiles p on p.id = c.id
  join cvs cv     on cv.id = c.current_cv_id
  left join locations loc on loc.key = c.location_key
  where c.is_searchable
    and c.deleted_at is null
    and p.deleted_at is null
    and cv.parsing_status = 'ready'
    and cv.deleted_at is null
    and exists (select 1 from candidate_profile_chunks ch where ch.candidate_id = c.id);

revoke all on candidate_search_profiles from anon, authenticated;

-- Both vectors read the Location's *name* through the relation, so searching the word
-- "Aleppo" still finds a Job in Aleppo now that the row holds a key. A generated column
-- cannot do that — its expression may only see its own row — so the column is plain and a
-- trigger fills it. Renaming a seeded Location is the one thing that would leave a vector
-- stale; whichever migration renames one re-touches the rows that point at it.

create function job_search_vector() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' ||
    coalesce((select l.name from public.locations l where l.key = new.location_key), ''));
  return new;
end;
$$;

alter table jobs add column search_vector tsvector;
create trigger set_search_vector before insert or update of title, description, location_key
  on jobs for each row execute function job_search_vector();
create index jobs_search_idx on jobs using gin (search_vector);

create function candidate_search_vector() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.headline, '') || ' ' || coalesce(new.summary, '') || ' ' ||
    coalesce((select l.name from public.locations l where l.key = new.location_key), ''));
  return new;
end;
$$;

alter table candidates add column search_vector tsvector;
create trigger set_search_vector before insert or update of headline, summary, location_key
  on candidates for each row execute function candidate_search_vector();
create index candidates_search_idx on candidates using gin (search_vector);
