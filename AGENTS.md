# AGENTS.md

Guidance for AI coding agents working in this repository.

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.

### Reach for an established dependency

If a well-known library already does it, add it, If the only library that does it is somebody's weekend project, do not add it. You are allowed to add dependencies.

### Don't comment

Comments should be **zero** unless it's **literally impossible** to infer from the code.

refrain from editing the readme.md file unless instructed to.

### PR

When you open a PR, talk in plain English.
