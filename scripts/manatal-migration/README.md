# Manatal migration

A one-off script that brings a Manatal account's candidates and their CVs into Sync, so Manatal
can be switched off afterwards. Not an integration: no webhook, no polling, no endpoints, no
screens, nothing left running.

Everything it needs is in this folder. It changes no schema, adds no table and no column, and
imports nothing from `services/api` — it talks to Postgres, Supabase Auth and Supabase Storage
directly, so the platform's code can keep moving without breaking it and deleting this folder
leaves no trace anywhere else.

## Running it

```bash
cd scripts/manatal-migration

export SYNC_DATABASE_URL=...                 # the same one the API uses
export SYNC_SUPABASE_URL=...
export SYNC_SUPABASE_SERVICE_ROLE_KEY=...
export MANATAL_API_TOKEN=...
export MANATAL_RECRUITER_ID=...              # the Recruiter to bring them in as

uv run migrate.py
```

The Recruiter's own row names the Tenant the candidates land in, so that is the only place the
Tenant is configured and the two cannot disagree.

### It takes two passes, and that is on purpose

**Pass one** (`uv run migrate.py`) makes an account per candidate, stores their CV, and stops.
Storing a CV enqueues a parse through the platform's own `ingest_on_upload` trigger, exactly as an
upload does — so the ordinary worker reads these CVs, and **the worker has to be running**.

**Pass two** (`uv run migrate.py --publish-only`) writes each parsed CV into its Candidate's
profile and makes them findable. Run it once the worker has caught up; anything not parsed yet is
left for the next time.

So the sequence is: run it, wait for the worker, run it again with `--publish-only`, repeat until
nothing is left waiting. The script tells you how many are still waiting each time.

### It is safe to run again, always

Every candidate is written to `manatal-migration-ledger.json` as it is dealt with, after each one
rather than at the end. A second run walks past everything settled, retries what failed, and
publishes whatever has since been parsed. Killing it mid-run loses nothing.

**Keep that ledger file.** Nothing is written to the database to say a Candidate came from
Manatal, so it is the only record of which Manatal candidate became which Candidate here — and
after Manatal is gone, the only record that they came from anywhere.

| Variable | Meaning |
| --- | --- |
| `SYNC_DATABASE_URL` | Postgres. The `+asyncpg` in the platform's own URL is stripped for you. |
| `SYNC_SUPABASE_URL`, `SYNC_SUPABASE_SERVICE_ROLE_KEY` | Auth and Storage. The service-role key: run this only from somewhere that key already belongs. |
| `MANATAL_API_TOKEN` | The Manatal API token. Not needed with `--publish-only`. |
| `MANATAL_RECRUITER_ID` | The Recruiter the candidates are brought in as. |
| `MANATAL_LIMIT` | Ceiling on one run. Default 10,000 — above the size of the account, so it is one pass. |
| `MANATAL_CONCURRENCY` | Candidates at once. Default 4. Each is a download and an upload, so this is what turns hours into minutes. |
| `MANATAL_API_BASE_URL`, `MANATAL_PAGE_SIZE`, `MANATAL_TIMEOUT_SECONDS` | Manatal host, page size, HTTP timeout. |

## What a migrated candidate becomes

An **unclaimed account** — a real `auth.users` row with a password nobody holds and an address
nobody has confirmed, because everything in this schema hangs off `candidates → profiles →
auth.users` and nothing else can own a CV. It cannot be signed into. Whoever owns it claims it
later through the ordinary password-reset flow.

Then, per candidate: a `candidates` row, their CV in the `cvs` bucket and a `cvs` row, an entry in
the importing Tenant's talent pool, and — once the worker has parsed the CV — a full profile
written from that parse, with `is_searchable` turned on.

**They enter Global search.** That is a deliberate instruction and worth being explicit about:
Global search is cross-tenant, so these people become visible to every Tenant on the platform, and
none of them opted in themselves. Global search also needs profile chunks, which the platform's
embedding worker writes when the profile is saved — so they appear once that worker has run, not
the moment this script finishes.

Two things the script refuses to do:

- **An address that already has an account is left completely alone** and recorded as
  `already_registered`. A migration never writes into a live Candidate's profile.
- **A profile that already has content is never overwritten.** Publishing checks first, so a
  re-run, or a Candidate who has claimed the account and edited it, is safe.

A candidate with no email address cannot have an account made for them and is recorded as
`no_email`. One Manatal holds no readable resume for is recorded as `no_resume`. Neither is a
failure, and neither is retried.

## Tests

```bash
cd scripts/manatal-migration
uv run pytest
```

They cover the Manatal client against a mock transport, the parse-to-rows mapping in every shape a
thin or broken parse arrives in, and the ledger's resume-and-retry behaviour. The parts that write
to Postgres, Auth and Storage are not covered here — they are exercised by running the script
against a staging database, which is the only place that proves anything about them.

## Afterwards

Delete this folder, and keep the ledger file. Nothing else in the repository mentions Manatal.
