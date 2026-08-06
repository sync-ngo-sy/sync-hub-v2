# 3. Status is a mark and a label; tags are one color

Date: 2026-08-06

## Status

Accepted

## Context

The shipped system rendered application status as filled chips, with four
`--chip-*` token pairs. Vellum (docs/design/vellum.md §4) replaces that with a
mark-and-label: an 8px mark (hollow ring for `new`, filled for progressing
states, circle-x icon for `rejected`/`withdrawn`) beside a plain-text label,
one status token per database `application_status` value, and a total color
vocabulary of one green ramp + amber + slate.

Separately, issue #184 point 13 asked for tenant-picked tag colors from a
predefined palette. A tenant palette is by definition more hues, which collides
with the closed vocabulary above and forces per-hue AA measurement in both
themes for colors we don't control the placement of.

## Decision

- All status rendering migrates to mark-and-label in one effort; the `--chip-*`
  tokens are deleted, not deprecated. No filled status pills remain.
- The eight `--status-*` tokens map 1:1 onto the `application_status` enum and
  nothing else. No status exists in the design system that does not exist in
  the database.
- Point 13 is narrowed: tenant tags get **no color palette and no picker**.
  Every tag renders in the same single neutral style. Tags stay visually
  distinct from status by shape (soft pill vs mark-and-label), not by hue.

## Consequences

- The status vocabulary stays measurable: every mark color is contrast-checked
  against the surfaces it actually sits on (evidence table in vellum.md §7).
- Reintroducing per-tag colors later means reopening this ADR and paying the
  two-theme AA measurement cost for the whole palette.
- Half-migrated states are forbidden: a filled chip appearing anywhere after
  this lands is a bug, not a transition.
