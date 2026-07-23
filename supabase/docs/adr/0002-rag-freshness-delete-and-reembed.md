# RAG freshness by delete-and-re-embed, not profile versioning

Status: accepted

We drop `candidates.profile_version` and `candidate_profile_chunks.profile_version` (and
with them the version-gated search predicate and the chunk GC job the DBML described).
Instead, any change to `candidates` or a `candidate_*` child table fires one shared
trigger that coalesces a re-embed job into a `candidate_embedding_jobs` queue (at most one
pending per candidate). The worker reads the candidate's **current** profile, computes
embeddings, then in a single transaction swaps chunks (`DELETE` old + `INSERT` new), and
clears the dirty flag only if no edit arrived while it was working (a revision on the
queue row, used purely for job coordination). Global search uses whatever chunks exist for
a searchable candidate.

## Considered options

- **Version-gated search (DBML original)** — rejected: a version column on `candidates`
  and on every chunk, a version match in every search query, and a GC job, all to
  reproduce the same "stale until re-embedded" window that the atomic delete-and-swap
  gives for free.
- **App-layer enqueue** — rejected: a forgotten write path silently serves stale
  embeddings. The trigger guarantees every write path enqueues.

## Consequences

- The job means "re-embed candidate X from current state," never "embed this content," so
  a burst of edits coalesces and the worker always embeds the latest profile.
- Correctness depends on two things: per-candidate coalescing, and the atomic chunk swap
  (so search never sees a half-embedded profile).
- There is a brief window after an edit where the candidate is not yet re-embedded — the
  same window the version-gated design produced.
