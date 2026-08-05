# Global search reaches its index through a filter, not a join

Status: accepted

Global search ranks profile chunks by vector distance and has an HNSW index built for exactly
that. The query must therefore be shaped so `candidate_profile_chunks` is the only relation the
distance-ordered scan reads: eligibility and every filter are applied as **scalar subqueries in
the `WHERE` clause**, never as a join to `candidate_search_profiles`.

```sql
SELECT ... FROM candidate_profile_chunks ch
WHERE (SELECT 1 FROM candidate_directory_profiles p
       WHERE p.candidate_id = ch.candidate_id AND <filters> LIMIT 1) IS NOT NULL
ORDER BY ch.embedding <=> $1
LIMIT $2
```

`hnsw.iterative_scan = strict_order` is set for the transaction, because pgvector applies those
filters *after* the index hands it rows.

## Considered options

- **Join the eligibility view into the scan** — rejected, and this is the trap. It reads better
  and it is measurably wrong: with the view joined, Postgres drives the plan from `candidates`
  instead, walks every chunk of everyone who passes the filter, and sorts. Measured on 12,000
  chunks: 24.6 ms and no index, against 3.6 ms and `Index Scan using
  candidate_profile_chunks_embedding_hnsw` for the subquery form.
- **`EXISTS (...)`, with or without `LIMIT 1`** — rejected: Postgres pulls an `EXISTS` sublink up
  into a semi-join, which is the join above by another spelling. Measured identically slow.
- **Materialise the eligible ids and filter with `= ANY(...)`** — rejected: the array is every
  Searchable Candidate on the platform.

## Consequences

- The two-step shape is load-bearing, not stylistic. A refactor that "simplifies" the subquery
  into a join silently removes the index from the plan and changes nothing a test asserting
  results would notice — so `test_the_search_reaches_its_vector_index_rather_than_every_chunk`
  asserts the plan itself.
- The scan reads `candidate_directory_profiles`, the base projection, rather than the chunk-gated
  `candidate_search_profiles`: scanning chunks already implies having them, and the gate would
  cost a bitmap scan per surviving row. The chunk-gated view is what the endpoint projects from
  once the ranking is down to one page.
- Filters cost an index probe per row the vector scan survives, which is why the scan budget is
  proportional to the page asked for rather than to the depth limit.
