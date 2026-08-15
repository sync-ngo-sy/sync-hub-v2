-- Moving an Application to `hired` is a Tenant saying what it believes happened. That claim is
-- recorded here with the day it says the work started, and the Candidate is asked. Only their
-- yes makes it a Placement — which is what `placements` selects, so nothing can count a hire
-- nobody confirmed.

create table hire_claims (
  application_id uuid primary key,
  tenant_id      uuid not null,

  claimed_by_recruiter_id uuid not null,
  -- The move the claim was made by, so the claim and the history entry cannot disagree about
  -- which `hired` this is.
  status_history_id uuid not null references application_status_history (id) on delete cascade,

  start_date date not null,

  confirmation hire_confirmation not null default 'unanswered',
  answered_at  timestamptz,

  claimed_at timestamptz not null default now(),

  -- Composite, like every other row a Tenant owns: a Recruiter of another Tenant cannot claim
  -- this Application even with the service role's reach.
  foreign key (tenant_id, application_id) references applications (tenant_id, id) on delete cascade,
  foreign key (tenant_id, claimed_by_recruiter_id) references recruiters (tenant_id, id),

  constraint hire_claim_answer_has_its_moment check (
    (confirmation = 'unanswered') = (answered_at is null)
  )
);
create index hire_claims_tenant_confirmation_idx on hire_claims (tenant_id, confirmation);

alter table hire_claims enable row level security;

-- A Candidate answers once. Withdrawing is final for the same reason: an answer that can be
-- taken back is a claim about today rather than a record of what was said.
create function forbid_reanswering_a_hire_claim() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.confirmation <> 'unanswered' then
    raise exception 'hire claim on application % was already answered: %',
      old.application_id, old.confirmation using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger answered_once before update of confirmation on hire_claims
  for each row when (new.confirmation is distinct from old.confirmation)
  execute function forbid_reanswering_a_hire_claim();

-- The view *is* the definition of a Placement rather than a report of one: there is no column
-- anywhere that a backend could set to make a hire count without the Candidate having said so.
-- security_invoker so the base table's RLS still applies; revoked from client roles.
create view placements with (security_invoker = true) as
  select
    application_id,
    tenant_id,
    claimed_by_recruiter_id,
    start_date,
    claimed_at,
    answered_at as confirmed_at
  from hire_claims
  where confirmation = 'confirmed';

revoke all on placements from anon, authenticated;
