-- 08 · Global-search eligibility view and full-text search
--
-- The view centralises the "who is discoverable" predicate (ADR-discussed). It is
-- security_invoker so base-table RLS still applies, and it is revoked from client roles;
-- the trusted backend joins it against candidate_profile_chunks for vector search. It never
-- exposes email (not stored here) or phone.

create view candidate_search_profiles with (security_invoker = true) as
  select
    c.id as candidate_id,
    p.full_name,
    p.avatar_url,
    c.headline,
    c.summary,
    c.location,
    c.preferred_language_code
  from candidates c
  join profiles p on p.id = c.id
  join cvs cv     on cv.id = c.current_cv_id
  where c.is_searchable
    and c.deleted_at is null
    and p.deleted_at is null
    and cv.parsing_status = 'ready'
    and cv.deleted_at is null
    and exists (select 1 from candidate_profile_chunks ch where ch.candidate_id = c.id);

revoke all on candidate_search_profiles from anon, authenticated;

-- Full-text search (exact keyword/boolean filters; vector search covers semantics) --------

alter table jobs add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))
  ) stored;
create index jobs_search_idx on jobs using gin (search_vector);

alter table candidates add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(headline, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(location, ''))
  ) stored;
create index candidates_search_idx on candidates using gin (search_vector);
