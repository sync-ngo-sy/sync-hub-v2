# Manatal migration

A one-off script that brings a Manatal account's candidates and their CVs into Sync, so Manatal
can be switched off afterwards. Not an integration: no webhook, no polling, no endpoints, no
screens, nothing left running.

Everything it needs is in this folder. It imports nothing from `services/api` — it talks to
Postgres, Supabase Auth and Supabase Storage directly, so the platform's code can keep moving
without breaking it. The one thing it needs from the platform is a column saying where these
Candidates came from; see below.

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

### Before you run it: know what you are moving

```bash
uv run migrate.py --inventory
```

Reads the account and reports **every field Manatal actually returns**, how often it is filled,
an example, and what this migration does with it — `migrated`, `archived only`, `no home in Sync`,
or `decide`. It writes nothing to the platform.

`decide` is the one to read. It means a field carrying real data that nobody has ruled on: either
it gets a home before the run, or somebody accepts losing it when Manatal is switched off. The
field map in `inventory.py` is seeded from Manatal's documented candidate object, and this is how
you check that guess against the account in front of you.

Everything read is also written verbatim to `manatal-candidates.jsonl`, one JSON object per line,
including fields with no home here. That archive is the reason a decision can still be taken
*after* the migration: a field kept can be backfilled, a field never read cannot.

### It takes two passes, and that is on purpose

**Pass one** (`uv run migrate.py`) makes an account per candidate, stores their CV, and stops.
Storing a CV enqueues a parse through the platform's own `ingest_on_upload` trigger, exactly as an
upload does — so the ordinary worker reads these CVs, and **the worker has to be running**.

**Pass two** (`uv run migrate.py --publish-only`) writes each parsed CV into its Candidate's
profile and makes them findable. Run it once the worker has caught up; anything not parsed yet is
left for the next time.

So the sequence is: run it, wait for the worker, run it again with `--publish-only`, repeat until
nothing is left waiting. The script tells you how many are still waiting each time.

### Afterwards: check it rather than trust it

```bash
uv run migrate.py --verify
```

Reads the platform back and compares it with the ledger, per candidate: the account exists, the
address matches, they are flagged as imported, they are in the talent pool, the `cvs` row is
theirs, **the file is really in the bucket and its bytes still hash to what Manatal served**, the
parse finished, and — for published ones — the profile has content, a current CV and
`is_searchable`. It also names candidates Manatal holds that the ledger has never seen, which is
how you learn a run did not finish walking the account.

Writes nothing, exits non-zero if anything disagrees, and fixes nothing: re-running the migration
is what mends what can be mended. It runs without `MANATAL_API_TOKEN` too — it just cannot tell
you who is missing from the ledger without asking Manatal who exists.

### It is safe to run again, always

Every candidate is written to `manatal-migration-ledger.json` as it is dealt with, after each one
rather than at the end. A second run walks past everything settled, retries what failed, and
publishes whatever has since been parsed. Killing it mid-run loses nothing.

**Keep the ledger and the archive.** The database records *that* a Candidate came from Manatal
(`candidates.is_imported_from_manatal`) but not *which* Manatal candidate they were — so once
Manatal is switched off, this file is the only thing that can map the two together.

| Variable | Meaning |
| --- | --- |
| `SYNC_DATABASE_URL` | Postgres. The `+asyncpg` in the platform's own URL is stripped for you. |
| `SYNC_SUPABASE_URL`, `SYNC_SUPABASE_SERVICE_ROLE_KEY` | Auth and Storage. The service-role key: run this only from somewhere that key already belongs. |
| `MANATAL_API_TOKEN` | The Manatal API token. Not needed with `--publish-only`. |
| `MANATAL_RECRUITER_ID` | The Recruiter the candidates are brought in as. |
| `MANATAL_LIMIT` | Ceiling on one run. Default 10,000 — above the size of the account, so it is one pass. |
| `MANATAL_CONCURRENCY` | Candidates at once. Default 4. Each is a download and an upload, so this is what turns hours into minutes. |
| `MANATAL_API_BASE_URL`, `MANATAL_PAGE_SIZE`, `MANATAL_TIMEOUT_SECONDS` | Manatal host, page size, HTTP timeout. |

## What of Manatal's data moves

| Manatal | Lands in | Note |
| --- | --- | --- |
| id | the ledger and the archive | how a candidate here maps back to one there |
| full_name / first_name + last_name | `profiles.full_name` | falls back to the address when nameless |
| email / emails | `auth.users.email` | the account is made from it; no address, no import |
| phone_number / phone / mobile | `profiles.phone` | |
| current_position / job_title | `candidates.headline` | replaced by the CV parse if it finds better |
| skills | `candidates.unmapped_skills` | free text here, a taxonomy there — the parse maps what it can, and these are merged, never replaced |
| resume | the `cvs` bucket + a `cvs` row | which triggers the ordinary parse |
| updated_at / created_at | the ledger | |
| experiences / educations / languages | **archived only** | the CV parse writes these tables in the taxonomy-mapped shape the schema stores; two writers is how a profile ends up with everything twice |
| stage / status / owner / organization | **no home** | Manatal's own workflow. Sync has its own Pipeline, per Application |
| anything else | **archived** | and reported by `--inventory` as `decide` |

Two rules behind that table. Nothing is dropped without being archived first, and where both
Manatal and the CV know something, the CV parse wins for the structured sections because it
produces the shape this schema actually stores.

## What a migrated candidate becomes

An **unclaimed account** — a real `auth.users` row with a password nobody holds and an address
nobody has confirmed, because everything in this schema hangs off `candidates → profiles →
auth.users` and nothing else can own a CV. It cannot be signed into. Whoever owns it claims it
later through the ordinary password-reset flow.

Then, per candidate: a `candidates` row flagged `is_imported_from_manatal`, their CV in the `cvs`
bucket and a `cvs` row, an entry in the importing Tenant's talent pool, and — once the worker has
parsed the CV — a full profile written from that parse, with `is_searchable` turned on.

That flag is the one thing this migration needs from the platform, because nothing else in the
schema would say where these Candidates came from: they would look exactly like people who signed
up. The talent pool shows it alongside whether the account has been **claimed**, which is not
stored anywhere — `auth.users.last_sign_in_at` already answers it, so a Recruiter reading the pool
sees "imported, never signed in" without a second column anybody has to remember to write.

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
thin or broken parse arrives in, the ledger's resume-and-retry behaviour, the field census and its
`decide` verdicts, the archive's append-and-resume, and the progress arithmetic. The parts that write
to Postgres, Auth and Storage are not covered here — they are exercised by running the script
against a staging database, which is the only place that proves anything about them.

## Afterwards

Delete this folder. Keep `manatal-migration-ledger.json` and `manatal-candidates.jsonl` —
together they are the only remaining record of what Manatal held and where each candidate went.

Two things outside it stay, and should: `candidates.is_imported_from_manatal` and the two fields
the talent pool reads it through. They are how a Recruiter knows, a year from now, that a profile
was read off a CV rather than typed by the person it describes — which outlives the script that
did the reading.
