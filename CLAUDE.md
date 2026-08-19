# Agent skills

## Issue tracker

Issues live in the repo's GitHub Issues (`sync-ngo-sy/sync-hub-v2`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

## Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

## Skills tree

Committed once under `.claude/skills/`; `.agents/skills` is a symlink to it. The tree is authoritative, `skills-lock.json` records provenance only. See `docs/agents/skills.md`.

## Domain docs

Multi-context — root `CONTEXT-MAP.md` pointing to a `CONTEXT.md` per workspace package. See `docs/agents/domain.md`.

## Don't comment

Comments should be **zero** unless it's **literally impossible** to infer from the code.

## PR

When you open a **PR** use ASD-STE100
