# Agent skills

## Skills tree

`.claude/skills/` is the only copy; `.agents/skills` is a symlink to it. Edit under `.claude/skills/`.

The tree is authoritative for what a skill says. `skills-lock.json` is authoritative only for where a vendored skill came from — it installs nothing and does not index the tree, so a skill with no entry is ours.

## Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

## Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

## Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.

## Don't comment

Comments should be **zero** unless it's **literally impossible** to infer from the code.

## PR

When you open a **PR** use ASD-STE100
