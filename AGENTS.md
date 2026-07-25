# AGENTS.md

Guidance for AI coding agents working in this repository.

## Reach for an established dependency — and only an established one

**If a well-known library already does it, add the library.** Writing your own JWKS cache,
HTTP client, rate limiter, retry loop, or parser for anything with an RFC number is a bug
you have not found yet, plus code this repo maintains forever.

**If the only library that does it is somebody's weekend project, do not add it.** Check the
numbers before you install: downloads a month first, then GitHub stars and last commit, and
weigh them against how central the code is. A few dozen stars means one maintainer and a
dependency we inherit the day they lose interest.

Before writing that kind of code:

1. Assume a library exists and go find it — including inside dependencies already here
   (`supabase-py`, PyJWT, SQLAlchemy, pydantic all do more than they first appear to).
2. Read the **current** docs with the `context7` skill (`npx ctx7@latest`). Your training
   data is stale; the method you need may have been added since.
3. Check its adoption. If nothing clears the bar, prefer in this order: the standard
   library, a first-party SDK from the service in question, then our own code.
4. Whatever you reject — the library or the hand-rolled version — say why *in the code*,
   with evidence: a download count, a probe, a specific input it mishandles.

See ADR-0007. `sync_api.problems` is what a justified "no library" looks like;
ADR-0004's note on `get_claims` is what a justified "not that library" looks like.

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.
