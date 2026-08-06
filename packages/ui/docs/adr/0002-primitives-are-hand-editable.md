# 2. Primitives are hand-editable; regeneration is abandoned

Date: 2026-08-06

## Status

Accepted

## Context

The Primitive definition said `components/ui/*` is shadcn CLI output "kept as
generated — never hand-edited". Vellum (point 22 of issue #184) changes the
default size of exactly those files: control height `h-8` → `h-9`, horizontal
padding `px-2.5` → `px-3`, and inputs gain `bg-input-background` in place of
`bg-transparent`. Tokens cannot express a Tailwind size class baked into a
variant string, so the rule and the redesign could not both survive.

Alternatives considered: wrapping every sized primitive in a Molecule that
re-exports with new defaults (a permanent extra layer that exists only to swap
two class names, and nothing stops an import of the raw primitive); or keeping
the files editable but treating CLI regeneration as a diff-review event.

## Decision

Primitives are our code. Edit `components/ui/*` directly; do not plan for
`shadcn` regeneration. The generated origin is history, not a constraint.

## Consequences

- Vellum's size/background changes land in the primitives themselves, so every
  call site gets them without churn.
- Running the shadcn CLI over these files would silently revert local edits.
  We accept that by declaring regeneration out of bounds — updating a primitive
  means editing it, not regenerating it.
- The Primitive definition in `packages/ui/CONTEXT.md` is amended accordingly.
