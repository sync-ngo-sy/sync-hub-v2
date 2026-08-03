import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { POOL_ENTRY_PATH, POOL_PATH } from '../hooks/use-talent-pool';
import type { PooledCandidate } from '../pool';

type Problem = components['schemas']['ProblemDetail'];

const ADDED_AT = '2026-08-03T12:00:00Z';

/** Cursor-paged the way the API is, so the portal's read of the whole pool is exercised rather
 * than assumed: the cursor is the index the next page starts at. */
function page(pool: PooledCandidate[], cursor: string | null, limit: number) {
  const from = cursor === null ? 0 : Number(cursor);
  const to = from + limit;
  return { items: pool.slice(from, to), next_cursor: to < pool.length ? String(to) : null };
}

export function holdsTalentPool(pool: PooledCandidate[]) {
  return [
    http.get(POOL_PATH, ({ query, response }) =>
      response(200).json(page(pool, query.get('cursor'), Number(query.get('limit') ?? 100))),
    ),
  ];
}

export function keepsTalentPool(pool: PooledCandidate[], asked?: string[]) {
  let current = [...pool];

  return [
    http.get(POOL_PATH, ({ query, response }) =>
      response(200).json(page(current, query.get('cursor'), Number(query.get('limit') ?? 100))),
    ),
    http.put(POOL_ENTRY_PATH, ({ params, response }) => {
      asked?.push(`save ${params.candidate_id}`);
      const already = current.find((entry) => entry.candidate_id === params.candidate_id);
      const saved: PooledCandidate = already ?? {
        candidate_id: params.candidate_id,
        full_name: 'Amina Haddad',
        headline: null,
        location_name: null,
        added_at: ADDED_AT,
      };
      if (!already) current = [saved, ...current];
      return response(200).json(saved);
    }),
    http.delete(POOL_ENTRY_PATH, ({ params, response }) => {
      asked?.push(`drop ${params.candidate_id}`);
      current = current.filter((entry) => entry.candidate_id !== params.candidate_id);
      return response(204).empty();
    }),
  ];
}

export function failsToReadTalentPool(problem: Problem) {
  return [http.get(POOL_PATH, ({ response }) => response(500).json(problem))];
}

export function refusesTalentPoolChange(pool: PooledCandidate[], problem: Problem) {
  return [
    http.put(POOL_ENTRY_PATH, ({ response }) => response(problem.status as 404).json(problem)),
    http.delete(POOL_ENTRY_PATH, ({ response }) => response(problem.status as 404).json(problem)),
    ...holdsTalentPool(pool),
  ];
}
