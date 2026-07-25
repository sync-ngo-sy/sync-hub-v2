# Reach for an established dependency first — and only an established one

Status: accepted

When a well-known, well-maintained library already solves a problem, we add it rather than
hand-roll a version. When the only library that solves it is somebody's weekend project, we
do not — we write the code and record why. Both halves matter, and the second is the one
that keeps the first from becoming its own kind of damage.

This is written down because the default failure mode of an AI agent — and of a hurried
human — is to hand-roll: a plausible fifty lines appear in seconds, they pass the tests
written against them, and nobody notices the same fifty lines exist, better, in a package a
million projects depend on. The costs are the ones that never surface in review: the edge
case nobody thought of, the security advisory that will never reach us, and every line now
ours to maintain forever.

## The bar

Judge a candidate on adoption and maintenance, not on how neatly its README reads:

- **Downloads per month** is the strongest single signal. Millions means the edge cases have
  been found by someone else.
- **GitHub stars and recent commits**, as a sanity check. A few dozen stars means one
  person, and it means we inherit the package the day they lose interest.
- **Weigh it against how central the code is.** A test-only helper can be more obscure than
  the library that verifies every access token or shapes every error response.

Where nothing clears the bar, prefer in this order: **the standard library**, then a
first-party SDK from the service we are already talking to, then our own code with a comment
saying what was evaluated and rejected.

## What this looked like in practice

Ticket #4 shipped a hand-written JWKS fetcher with its own cache, a hand-written HTTP client
for GoTrue, and a hand-written sliding-window rate limiter. All three had established
libraries — PyJWT (5.7k stars), `supabase-py` (the vendor's own SDK), `limits` (43M
downloads a month) — and all three were replaced. The walking skeleton's request-id
middleware went the same way, to `asgi-correlation-id` (6M downloads a month).

Two things were kept, both recorded where the code lives:

- **RFC 9457 problem details** (`sync_api.problems`). `fastapi-problem` has 35 stars;
  `fastapi-rfc9457` is v0.2.1. Neither is something to hand every error response to.
- **Access-token verification** (`sync_api.auth.tokens`). `supabase-py` has `get_claims`, but
  probed against our own stack it *accepts* a token forged with the project's legacy shared
  HS256 secret. See ADR-0004.

## How to apply it

- **Look before you write.** Anything that smells like solved infrastructure — protocol
  clients, caching, retries, rate limiting, token verification, parsing of any format with
  an RFC number — has a library. Check.
- **Check what today's version does**, not what you remember. Use the `context7` skill (or
  `npx ctx7@latest`); training data goes stale and the method you need may be newer than it.
- **Check the numbers before you add it.** Downloads, stars, last commit.
- **Prefer the layer that fits.** `slowapi` wraps `limits`; when the wrapper's shape fights
  the codebase, take the primitive underneath rather than reimplementing either.

## When writing it yourself is right

Only for a *demonstrated* mismatch, recorded where the code lives. Three shapes qualify:
nothing established exists; the established thing is wrong for this use and you can show it;
or the code is ours by nature — domain rules, our HTTP contract, the vocabulary of errors we
answer with. A library cannot know what a Candidate is.

"It is only a few lines" is not on that list. A few lines is exactly what the rate limiter
looked like.

## Consequences

- Established dependencies get added more freely than a minimal-footprint instinct would
  like. That is the intended trade.
- An obscure dependency in a diff is as much a question to answer as a hand-rolled utility
  is — the answer just has to be about the package instead of the code.
