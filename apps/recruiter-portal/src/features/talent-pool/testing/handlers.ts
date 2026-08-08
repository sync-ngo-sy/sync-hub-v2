import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { POOL_ENTRY_PATH, POOL_PATH } from '../hooks/use-talent-pool';
import type { PooledCandidate, TalentPoolOrder } from '../pool';

type Problem = components['schemas']['ProblemDetail'];

const ADDED_AT = '2026-08-03T12:00:00Z';

const IN_ORDER: Record<TalentPoolOrder, (left: PooledCandidate, right: PooledCandidate) => number> =
  {
    newest: (left, right) => right.added_at.localeCompare(left.added_at),
    oldest: (left, right) => left.added_at.localeCompare(right.added_at),
    name: (left, right) => left.full_name.localeCompare(right.full_name),
    name_reversed: (left, right) => right.full_name.localeCompare(left.full_name),
  };

function matching(pool: PooledCandidate[], wanted: string | null | undefined): PooledCandidate[] {
  const written = (wanted ?? '').trim().toLocaleLowerCase();
  if (written === '') return pool;
  return pool.filter((entry) =>
    `${entry.full_name} ${entry.headline ?? ''}`.toLocaleLowerCase().includes(written),
  );
}

interface Asked {
  q: string | null | undefined;
  sort: TalentPoolOrder | null | undefined;
  cursor: string | null | undefined;
  limit: string | null | undefined;
}

function page(pool: PooledCandidate[], asked: Asked) {
  const listed = [...matching(pool, asked.q)].sort(IN_ORDER[asked.sort ?? 'newest']);
  const from = asked.cursor == null ? 0 : Number(asked.cursor);
  const to = from + Number(asked.limit ?? 100);
  return { items: listed.slice(from, to), next_cursor: to < listed.length ? String(to) : null };
}

function pages(pool: () => PooledCandidate[]) {
  return http.get(POOL_PATH, ({ query, response }) =>
    response(200).json(
      page(pool(), {
        q: query.get('q'),
        sort: query.get('sort'),
        cursor: query.get('cursor'),
        limit: query.get('limit'),
      }),
    ),
  );
}

export function holdsTalentPool(pool: PooledCandidate[]) {
  return [pages(() => pool)];
}

export function keepsTalentPool(pool: PooledCandidate[], asked?: string[]) {
  let current = [...pool];

  return [
    pages(() => current),
    http.put(POOL_ENTRY_PATH, ({ params, response }) => {
      asked?.push(`save ${params.candidate_id}`);
      const already = current.find((entry) => entry.candidate_id === params.candidate_id);
      const saved: PooledCandidate = already ?? {
        candidate_id: params.candidate_id,
        full_name: 'Amina Haddad',
        avatar_url: null,
        headline: null,
        location_name: null,
        canonical_role_name: null,
        total_experience_years: 0,
        tags: [],
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
