-- security_invoker so base-table RLS still applies; revoked from client roles. Neither view
-- exposes email (not stored here) or phone.
create view candidate_directory_profiles with (security_invoker = true) as
  select
    c.id as candidate_id,
    c.created_at,
    p.full_name,
    p.avatar_url,
    c.headline,
    c.summary,
    c.location_key,
    loc.name as location_name,
    c.canonical_role_key,
    role.name as canonical_role_name,
    c.total_experience_years,
    c.preferred_language_code
  from candidates c
  join profiles p on p.id = c.id
  join cvs cv     on cv.id = c.current_cv_id
  left join locations loc       on loc.key = c.location_key
  left join canonical_roles role on role.key = c.canonical_role_key
  where c.is_searchable
    and c.deleted_at is null
    and p.deleted_at is null
    and cv.parsing_status = 'ready'
    and cv.deleted_at is null;

create view candidate_search_profiles with (security_invoker = true) as
  select d.*
  from candidate_directory_profiles d
  where exists (select 1 from candidate_profile_chunks ch where ch.candidate_id = d.candidate_id);

revoke all on candidate_directory_profiles from anon, authenticated;
revoke all on candidate_search_profiles    from anon, authenticated;

-- The Job vector reads the Location's *name* through the relation, so searching the word
-- "Aleppo" still finds a Job in Aleppo now that the row holds a key. A generated column cannot
-- do that — its expression may only see its own row — so the column is plain and a trigger
-- fills it. Renaming a seeded Location is the one thing that would leave a vector stale;
-- whichever migration renames one re-touches the rows that point at it.

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
