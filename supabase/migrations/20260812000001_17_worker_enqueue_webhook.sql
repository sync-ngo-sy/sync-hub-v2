-- The notification half of the worker's two callers: when something is enqueued, tell the worker
-- now rather than waiting up to three minutes for the schedule to notice.
--
-- The schedule is still what *guarantees* nothing is stranded. This only removes the wait. So
-- everything here fails soft: if the worker's address or secret is missing, the insert still
-- succeeds and the schedule picks the row up on its next pass. An enqueue must never fail because
-- a notification could not be sent.
--
-- Written as a migration rather than created in the dashboard, because the dashboard's webhook
-- builder writes into a `supabase_functions` schema that only exists once someone has pressed its
-- button -- which is how a database ends up with behaviour no environment can reproduce.

create extension if not exists pg_net with schema extensions;

-- The address and the secret live in Vault, not here. A migration is committed; the secret is not.
-- They are written out of band, once per environment, next to the other secret values:
--
--   select vault.create_secret('https://worker-xxxx.a.run.app/drain', 'worker_drain_url');
--   select vault.create_secret('<SYNC_WORKER_SHARED_SECRET>',         'worker_shared_secret');
--
create or replace function public.notify_worker_of_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url    text;
  worker_secret text;
begin
  select decrypted_secret into worker_url
    from vault.decrypted_secrets where name = 'worker_drain_url';
  select decrypted_secret into worker_secret
    from vault.decrypted_secrets where name = 'worker_shared_secret';

  -- Not configured yet is a normal state, not an error: a fresh environment has rows to enqueue
  -- before anybody has written a secret. The schedule covers the gap.
  if worker_url is null or worker_secret is null then
    return null;
  end if;

  -- `net`, not `extensions`: the extension is registered in `extensions` but pg_net creates its
  -- own `net` schema for the functions, and `search_path` is empty here so the wrong qualification
  -- is not a warning but a silent no-op -- swallowed by the handler below, which is exactly how a
  -- notification that never fires looks like one that works.
  --
  -- pg_net queues the request and returns immediately, so an enqueue never waits on the worker
  -- answering -- or on it being awake at all.
  perform net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'X-Worker-Secret', worker_secret
    ),
    body    := '{}'::jsonb
  );
  return null;
exception
  when others then
    -- Deliberately swallowed. A failure to notify is a latency problem; a failure to insert is a
    -- lost CV. The schedule turns the first into the second's absence.
    raise warning 'notify_worker_of_enqueue failed: %', sqlerrm;
    return null;
end;
$$;

-- Per statement, not per row. A bulk insert of forty CVs is one drain, not forty: the worker
-- empties the whole queue whichever row woke it.
create trigger ingestion_jobs_notify_worker
  after insert on public.ingestion_jobs
  for each statement
  execute function public.notify_worker_of_enqueue();

-- Communications are the other queue a person is waiting on -- an invite or a reset that arrives
-- three minutes late reads as broken. Embeddings are deliberately left out: they follow an
-- ingestion that has already woken the worker, and a profile edit should not post to the network.
create trigger communications_notify_worker
  after insert on public.communications
  for each statement
  execute function public.notify_worker_of_enqueue();

-- A Recruiter opening a Job seconds after an Application arrives should find a Match score there,
-- not a blank waiting for the next schedule. The Application's own confirmation email is enqueued
-- in the same transaction, so this frequently coalesces into that drain rather than adding one.
create trigger match_assessment_jobs_notify_worker
  after insert on public.match_assessment_jobs
  for each statement
  execute function public.notify_worker_of_enqueue();

revoke all on function public.notify_worker_of_enqueue() from public, anon, authenticated;
