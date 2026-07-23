-- 09 · Row-level security and grants (ADR root-0002)
--
-- Access is backend-only. Every public table gets RLS ENABLED with NO policies, so the
-- client roles (anon, authenticated) can read/write zero rows even if they reach PostgREST.
-- We also REVOKE table/sequence privileges from those roles so access is denied outright.
-- The trusted backend connects as service_role, which bypasses RLS.
--
-- RLS is ENABLED but not FORCED on purpose: FORCE would also subject the table owner
-- (postgres) to RLS, which would block this migration bundle's own reference-data seed.

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

-- Deny the Data API surface to client roles.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;

-- Ensure the trusted backend (service_role) retains full access.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Future objects created in public follow the same rule.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public grant  all on tables    to service_role;
alter default privileges in schema public grant  all on sequences to service_role;
