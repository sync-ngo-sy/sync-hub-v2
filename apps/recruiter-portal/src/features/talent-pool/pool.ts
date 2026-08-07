import type { components } from '@sync/api-client';

export type PooledCandidate = components['schemas']['PooledCandidate'];
export type PoolPage = components['schemas']['TalentPoolPage'];

export const POOL_PAGE_SIZE = 100;

export const DROP_REFUSED = "That Candidate couldn't be dropped. Your talent pool is as it was.";

export function droppedSays(fullName: string): string {
  return `${fullName} dropped from your talent pool`;
}

export const MAX_POOL_PAGES = 50;

export async function readWholePool(
  read: (cursor: string | null) => Promise<PoolPage>,
): Promise<PooledCandidate[]> {
  const pool: PooledCandidate[] = [];
  const asked = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_POOL_PAGES; page += 1) {
    const answer: PoolPage = await read(cursor);
    pool.push(...answer.items);

    const next = answer.next_cursor;
    if (next === undefined || next === null || asked.has(next)) return pool;

    asked.add(next);
    cursor = next;
  }

  return pool;
}
