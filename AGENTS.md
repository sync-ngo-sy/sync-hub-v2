# AGENTS.md

Guidance for AI coding agents working in this repository.

## Reach for a dependency before writing it yourself

**If a maintained library already does it, add the library.** Writing your own JWKS cache,
HTTP client, rate limiter, retry loop, or parser for anything with an RFC number is a bug
you have not found yet, plus code this repo now maintains forever. A hand-rolled utility
turning up in review is a question to answer, not a neutral choice.

Before writing that kind of code:

1. Assume a library exists and go find it — including inside dependencies already here
   (`supabase-py`, PyJWT, SQLAlchemy, pydantic all do more than they first appear to).
2. Read the **current** docs with the `context7` skill (`npx ctx7@latest`). Your training
   data is stale; the method you need may have been added since.
3. If you conclude the library does not fit, say why *in the code*, with evidence — a probe,
   a specific input it mishandles. "It felt heavy" is not a reason.

Adding a dependency is cheap and reviewable. Adding a subtly wrong reimplementation is not.
See ADR-0007, and ADR-0004's note on `get_claims` for what a justified exception looks like.

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.
