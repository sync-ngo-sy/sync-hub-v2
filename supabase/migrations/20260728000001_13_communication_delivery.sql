-- The sender drives `communications` as a table queue (ADR-0003), the way `ingestion_jobs`
-- is driven: the row it claims is the audit row it settles, so delivery evidence and queue
-- state can never disagree. `communication_status` already spells the four states; these are
-- the three timestamps the claim, the retry and the sweep need.
--
-- `completed_at` is when the queue let go of the row, whichever way it went; `sent_at` stays
-- what it was — when a provider accepted the message.

alter table communications
  add column available_at timestamptz,
  add column started_at   timestamptz,
  add column completed_at timestamptz;

create index communications_claim_idx on communications (available_at)
  where status in ('queued', 'processing');
