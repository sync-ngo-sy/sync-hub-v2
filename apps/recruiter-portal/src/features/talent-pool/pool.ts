import type { components } from '@sync/api-client';

export type PooledCandidate = components['schemas']['PooledCandidate'];
export type PoolPage = components['schemas']['TalentPoolPage'];
export type TalentPoolOrder = components['schemas']['TalentPoolOrder'];

export const POOL_PAGE_SIZE = 100;

export const DEFAULT_ORDER: TalentPoolOrder = 'newest';

const ORDERS: TalentPoolOrder[] = ['newest', 'oldest', 'name', 'name_reversed'];

export interface PoolReading {
  q: string;
  order: TalentPoolOrder;
}

export function orderFrom(value: string | undefined): TalentPoolOrder {
  return ORDERS.find((order) => order === value) ?? DEFAULT_ORDER;
}

export function poolQuery(reading: PoolReading) {
  return { q: reading.q.trim() || undefined, sort: reading.order };
}

export function poolAddress(reading: PoolReading) {
  return {
    q: reading.q.trim() || undefined,
    sort: reading.order === DEFAULT_ORDER ? undefined : reading.order,
  };
}

export const DROP_REFUSED = "That Candidate couldn't be dropped. Your talent pool is as it was.";

export const NOBODY_SAVED =
  'Nobody saved yet — search reaches every Candidate on the platform who has opted into being found.';

export function nobodyMatches(q: string): string {
  return `Nobody in your talent pool reads as “${q.trim()}”. The words are matched against names and headlines.`;
}

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
