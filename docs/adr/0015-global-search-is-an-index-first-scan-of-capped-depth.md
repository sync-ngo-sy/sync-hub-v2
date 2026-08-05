# Global search is an index-first scan of capped depth

Global search reaches the HNSW index before it does anything else — a plain
`ORDER BY embedding <=> query LIMIT k` over the chunks, in a CTE or lateral join, whose
results are then joined back to Candidates and deduplicated to one best fragment each. The
previous query deduplicated first, with `DISTINCT ON (candidate_id) ORDER BY candidate_id,
distance`, and that ordering makes the index unusable: Postgres computed a distance for
every chunk in the system, sorted the lot by candidate, and then re-sorted by distance to
throw nearly all of it away. Filters cannot simply be bolted onto the repaired query either,
because pgvector applies a `WHERE` clause *after* the index scan, not during it — a
condition matching a tenth of the rows leaves about four survivors out of the default
`hnsw.ef_search` of 40. So the search sets `hnsw.iterative_scan = strict_order` for its
transaction and lets pgvector widen the walk until enough rows survive the filter, with
`strict_order` chosen over `relaxed_order` because paging needs the distance ordering to be
exact. Rejected: over-fetching by some multiplier and filtering in the application, where no
principled multiplier exists and a selective filter fails by silently returning "no results".

One search reaches a fixed maximum number of Candidates, and pages are offsets into that
depth, with the response saying when the cap was reached so the interface can ask for a
narrower question instead of implying there is more. Rejected: a cursor on distance, which
breaks the graph traversal it depends on; and caching an ordered list of ids per query in
Redis, which is a whole service, its operations and a TTL policy nobody has chosen, added to
a stack that runs an API, a worker and Postgres. Depth is capped rather than unbounded
because recall through an approximate index decays as you page into it, so an endpoint that
offered page fifty would be promising an accuracy it does not have.
