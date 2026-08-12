-- pg_net gives a request five seconds by default, and a worker scaling from zero routinely takes
-- longer than that to answer: the cold start builds the database pool and the model clients, which
-- is why its own startup probe allows forty.
--
-- The call still succeeds when it times out -- the worker receives the request, drains, and returns
-- 200 to nobody. So this fixes noise rather than behaviour, which is the point: an error logged on
-- every cold start is an error nobody reads, and the next real one hides inside it.
--
-- Thirty seconds covers a cold start and an ordinary drain. A long drain still times out, and that
-- remains harmless: the worker keeps working, and the schedule collects whatever is left.

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
  -- own `net` schema for the functions, and `search_path` is empty here.
  perform net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'X-Worker-Secret', worker_secret
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
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
