-- Every public table: RLS ENABLED with NO policies, plus REVOKE, so anon/authenticated read
-- and write zero rows even via PostgREST. The trusted backend is service_role, which
-- bypasses RLS. ENABLED but deliberately not FORCED: FORCE would subject the postgres owner
-- to RLS too, blocking this bundle's own reference-data seed in migration 11.

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end;
$$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public grant  all on tables    to service_role;
alter default privileges in schema public grant  all on sequences to service_role;
