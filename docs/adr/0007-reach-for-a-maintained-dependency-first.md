# Reach for a maintained dependency before writing the thing yourself

Status: accepted

When a well-maintained library already solves a problem, we add it rather than hand-roll a
version. This is written down because the default failure mode of an AI agent — and of a
hurried human — is the opposite: a plausible fifty lines appear in seconds, they pass the
tests that were written against them, and nobody notices that the same fifty lines exist,
better, in a package a million projects depend on.

The costs of the hand-rolled version are the ones that do not show up in review: the edge
case nobody thought of, the security advisory that will never reach us, and the fact that
every line is now ours to maintain forever. A dependency's cost is visible and bounded —
one line in `pyproject.toml`, an audit trail, someone else's test suite.

## What this looked like in practice

Ticket #4 (candidate auth) first shipped a hand-written JWKS fetcher with its own cache, a
hand-written HTTP client for GoTrue with its own error-body parsing, and a hand-written
sliding-window rate limiter. All three had libraries: PyJWT's `PyJWKClient`, `supabase-py`,
and `limits`. All three were replaced.

## How to apply it

- **Look before you write.** Anything that smells like solved infrastructure — protocol
  clients, caching, retries, rate limiting, token verification, date handling, parsing of
  any format with an RFC number — has a library. Check.
- **Check what today's version does**, not what you remember it doing. Use the `context7`
  skill (or `npx ctx7@latest`) to read the current docs; training data goes stale and the
  method you need may have been added since.
- **Prefer the layer that fits.** `slowapi` wraps `limits`; when the wrapper's shape fights
  the codebase, take the primitive underneath rather than reimplementing either.

## When writing it yourself is right

Rarely, and never by default. The bar is a *demonstrated* mismatch, recorded where the code
lives — not a feeling that the library is heavy. Two shapes qualify:

- **The library is wrong for this use.** Show it. ADR-0004's note on `get_claims` is the
  worked example: a probe against our own stack, a specific token it accepts and we must
  not.
- **The code is ours by nature.** Domain rules, our HTTP contract, the vocabulary of errors
  we answer with. A library cannot know what a Candidate is.

"It is only a few lines" is not on that list; a few lines is exactly what the rate limiter
looked like.

## Consequences

- Dependencies get added more freely than a minimal-footprint instinct would like. That is
  the intended trade: review the dependency (maintained? sane licence? reasonable
  transitive weight?) rather than avoid it.
- A hand-rolled utility arriving in review is a question to answer — "what did you check,
  and why did it not fit?" — not a neutral choice.
