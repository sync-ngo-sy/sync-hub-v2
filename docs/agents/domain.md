# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **multi-context** monorepo: each workspace package (`apps/*`, `packages/*`, `services/*`) is its own context with its own `CONTEXT.md`, tied together by a root `CONTEXT-MAP.md`.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context (workspace package). Read each one relevant to the topic.
- The relevant per-package **`CONTEXT.md`** — e.g. `apps/candidate-portal/CONTEXT.md`, `services/api/CONTEXT.md`, `packages/ui/CONTEXT.md`.
- **`docs/adr/`** at the repo root — system-wide architectural decisions. Read ADRs that touch the area you're about to work in.
- Context-scoped ADRs at **`<package>/docs/adr/`** (e.g. `services/api/docs/adr/`) for decisions local to one package.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context monorepo (presence of `CONTEXT-MAP.md` at the root):

```
/
├── CONTEXT-MAP.md                       ← index of every context
├── docs/adr/                            ← system-wide decisions
├── apps/
│   ├── candidate-portal/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                    ← context-specific decisions
│   └── recruiter-portal/
│       ├── CONTEXT.md
│       └── docs/adr/
├── packages/
│   ├── api-client/CONTEXT.md
│   ├── db-types/CONTEXT.md
│   └── ui/CONTEXT.md
└── services/
    └── api/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
