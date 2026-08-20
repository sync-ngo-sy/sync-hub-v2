# Manatal migration

A one-off script that brings a Manatal account's candidates and their CVs into Sync, so Manatal
can be switched off afterwards. Not an integration: no webhook, no polling, no endpoints, no
screens, nothing left running.

Everything it needs is in this folder. It imports nothing from `services/api` — it talks to
Postgres, Supabase Auth and Supabase Storage directly, so the platform's code can keep moving
without breaking it. The one thing it needs from the platform is a column saying where these
Candidates came from; see below.

## Running it without a terminal

**Actions → Manatal migration → Run workflow.** Pick what to do, click the button, approve the run
when GitHub asks. The log says what is happening in plain words as it goes, and the run's own page
ends up with the numbers on it — how many moved, how many are findable, and what is missing for
anybody who is not. Nothing to install and nothing to download.

Do it in this order:

1. **check** — answers everything that has to be true, changes nothing. Start here every time.
2. **inventory** — what Manatal actually holds, field by field. Reads Manatal only.
3. **import and publish** — the real thing.
4. wait for the platform's worker to read the CVs, then **publish only**, until nothing is waiting.
5. **verify** — reads the platform back and checks every claim. **report** — says it again, any time.

The workflow needs five secrets on its `manatal-migration` environment: `SYNC_DATABASE_URL`,
`SYNC_SUPABASE_URL`, `SYNC_SUPABASE_SERVICE_ROLE_KEY`, `MANATAL_API_TOKEN` and
`MANATAL_RECRUITER_ID`. Configure a required reviewer on that environment too: approving a run is
how somebody accepts that 5,000 people are about to be written into production.

Two things to know about it. The run keeps the ledger as an artifact and fetches it back at the
start of the next one — that file is what makes a second run skip whoever is already done, so a
run that cannot fetch it would try to import everybody again. And **those artifacts hold personal
data**: 5,000 names and email addresses, downloadable by anyone who can read this repository. That
is the price of the run being a button, and it holds only while the repository stays private.

### Or from your own machine

`migrate.cmd` on Windows, `./migrate.sh` anywhere else. Same steps, same words, and it asks for the
Manatal key rather than needing it set.

## Running it by hand

```bash
cd scripts/manatal-migration

export SYNC_DATABASE_URL=...                 # the same one the API uses
export SYNC_SUPABASE_URL=...
export SYNC_SUPABASE_SERVICE_ROLE_KEY=...
export MANATAL_RECRUITER_ID=...              # the Recruiter to bring them in as
export MANATAL_PHONE_REGION=SY               # optional; where local phone numbers are from

uv run migrate.py --check                    # nothing is changed by this
uv run migrate.py
uv run migrate.py --report
```

The Manatal API key is asked for when it is needed, and not echoed as you type — so it does not
end up in a file or in the shell's history. Set `MANATAL_API_TOKEN` instead if the run has nobody
at the keyboard.

The Recruiter's own row names the Tenant the candidates land in, so that is the only place the
Tenant is configured and the two cannot disagree.

### `--check` first, always

It answers, one line each: is the Manatal key good, can we reach Supabase and the database, have
the migrations been applied to *this* environment, does the platform have its lists of locations,
roles, skills and languages, and is the recruiter this is attributed to a real one. Anything that
fails says what to do about it. Nothing is written either way.

The taxonomy checks matter more than they look. An empty list is not an error the database
reports — it just means nothing matches, and the migration would bring 5,000 people across with no
location, no role and no skills, which leaves every one of them out of Global search.

### `--report` afterwards

Says how many moved, how many have a complete profile, how many other companies can find, and —
for everybody who is not yet findable — which of the ten facts they are missing, most common
first. It reads only the ledger, so it can be run any time and changes nothing. It also writes
`manatal-migration-report.html`, which is the version to keep and to send on.

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
profile, and makes findable whoever has both agreed to it and ended up with a complete profile.
Run it once the worker has caught up; anything not parsed yet is left for the next time.

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
the two markers a findable Candidate carries. It also names candidates Manatal holds that the
ledger has never seen, which is how you learn a run did not finish walking the account.

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
| `MANATAL_API_TOKEN` | The Manatal API token. Asked for interactively when unset. Not needed with `--publish-only`, `--verify` or `--report`. |
| `MANATAL_RECRUITER_ID` | The Recruiter the candidates are brought in as. |
| `MANATAL_LIMIT` | Ceiling on one run. Default 10,000 — above the size of the account, so it is one pass. |
| `MANATAL_CONCURRENCY` | Candidates at once. Default 4. Each is a download and an upload, so this is what turns hours into minutes. |
| `MANATAL_PHONE_REGION` | Which country a local phone number with no country code belongs to, as two capitals. Default `SY`. |
| `MANATAL_API_BASE_URL`, `MANATAL_PAGE_SIZE`, `MANATAL_TIMEOUT_SECONDS` | Manatal host, page size, HTTP timeout. |

## What of Manatal's data moves

| Manatal | Lands in | Note |
| --- | --- | --- |
| id | the ledger and the archive | how a candidate here maps back to one there |
| full_name / first_name + last_name | `profiles.full_name` | falls back to the address when nameless |
| email / emails | `auth.users.email` | the account is made from it; no address, no import |
| phone_number / phone / mobile | `profiles.phone` + `profiles.phone_country` | read into E.164; an unreadable number is left out rather than guessed at |
| linkedin_url / custom `linkedinprofile` | `candidates.linkedin_url` | normalised to `https://www.linkedin.com/in/…` |
| current_position / job_title | `candidates.headline` and `candidates.canonical_role_key` | the parse's role wins; this is matched against the taxonomy where it proposed none |
| consent | `candidates.is_searchable` | whether other Tenants may find them. Anything but a plain yes is read as no |
| skills | `candidates.unmapped_skills`, and `candidate_skills` for the ones the taxonomy knows | free text here, a taxonomy there. Every skill is kept either way; only the matched ones count toward a complete profile |
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
parsed the CV — a full profile written from that parse.

That flag is the one thing this migration needs from the platform, because nothing else in the
schema would say where these Candidates came from: they would look exactly like people who signed
up. The talent pool shows it alongside whether the account has been **claimed**, which is not
stored anywhere — `auth.users.last_sign_in_at` already answers it, so a Recruiter reading the pool
sees "imported, never signed in" without a second column anybody has to remember to write.

### Who enters Global search, and who does not

Two things have to be true, and the migration cannot make either of them true on its own.

**They have to have agreed.** The platform's own words for `is_searchable` are "opt in to
cross-tenant Global search" — it is the candidate's decision, not the Tenant's. Manatal records
that decision in its `consent` field, so that is what decides it here: everybody is migrated, and
the ones who agreed are the ones other Tenants can find. Anything other than a plain yes is read
as no, because the cost of reading it the wrong way is showing somebody to companies they never
applied to. `--report` says how the 5,000 split.

**The profile has to be complete.** `candidates` enforces this in the row itself: `is_searchable`
requires `profile_completed_at`, which requires all ten of a read CV, name, phone *with* its
country, job title, location, canonical role, summary, and at least one education, skill and
language. Nine out of ten is not nine tenths findable — it is not findable. So the migration fills
every one of those it can, from the parse first and Manatal's own fields second, then reads the row
back and only writes the two markers if they have been earned. `--report` names which requirement
is missing for everybody who is short.

The two most common ones to be short of are the canonical role and a canonical skill, because both
are matched against the platform's lists and Manatal has only free text. Matching is deliberately
narrow — a confident wrong role files somebody under work they do not do — so unmatched is a normal
outcome, and the fix is usually to extend the taxonomy and run `--publish-only` again.

Even for those who qualify, Global search needs profile chunks, which the platform's embedding
worker writes when the profile is saved. They appear once that worker has run, not the moment this
script finishes.

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
