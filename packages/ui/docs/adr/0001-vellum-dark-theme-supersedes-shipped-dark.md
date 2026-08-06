# 1. Vellum's dark theme supersedes the shipped dark theme

Date: 2026-08-06

## Status

Accepted

## Context

`docs/design/vellum-tokens.css` §4 says its dark block is "deliberately unchanged
from what ships today". That claim is false: it differs from the `.dark` block in
`packages/ui/src/styles/globals.css` on core tokens — `--background` (`#131211` →
`#1C1A17`), `--card` (`#1C1A19` → `#252220`), `--primary` (`#0E8177` with white
foreground → `#23A092` with dark foreground), and the ring/chart/sidebar teal
family. Integrating vellum therefore forces a choice the document pretends does
not exist: keep the shipped dark values and only add the new tokens, or take
vellum's dark block wholesale.

## Decision

Vellum's dark values win wholesale. Both themes come from the vellum token set.

## Consequences

- Light and dark stay one system: vellum's dark neutrals were re-derived to match
  the warm light ramp, and the flipped `--primary-foreground` (dark text on the
  bright teal) is the accessible pairing for `#23A092`.
- The shipped dark values are dead. Do not "restore" them on the strength of the
  "deliberately unchanged" comment in `vellum-tokens.css` — that comment is
  wrong, and this ADR exists so nobody trusts it.
