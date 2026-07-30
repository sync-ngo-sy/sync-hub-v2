# AGENTS.md

Guidance for AI coding agents working in this repository.

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.

### Reach for an established dependency — and only an established one

If a well-known library already does it, add it.

If the only library that does it is somebody's weekend project, do not add it.

You are allowed to add dependencies.

### Don't over-comment

Only reach for a comment when it's impossible to infer or understand without code.

Comments inside the frontend should be very few, almost zero.

Please refrain from editing the readme.md file unless instructed to do so.

### Commiting

Don't include the `co-authored-by` line at the end of commits.
