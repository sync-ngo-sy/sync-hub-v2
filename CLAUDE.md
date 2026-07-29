# AGENTS.md

Guidance for AI coding agents working in this repository.

## Agent skills

### Reach for an established dependency — and only an established one

If a well-known library already does it, add the library.

If the only library that does it is somebody's weekend project, do not add it.

Example: Instead of implementing retry logic from scratch, reach for Tenacity. This is just an example, so you must decide when there is a similar case.

you are allowed to add dependencies.

### Don't over comment

Only reach for a comment when it's impossible to infer or understand without code.

Don't edit the readme.md file unless explicitly told to.

### Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.
