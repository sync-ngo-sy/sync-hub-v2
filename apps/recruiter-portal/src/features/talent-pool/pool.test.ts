import { describe, expect, it, vi } from 'vitest';
import { MAX_POOL_PAGES, type PooledCandidate, type PoolPage, readWholePool } from './pool';

function saved(id: string): PooledCandidate {
  return {
    candidate_id: id,
    full_name: `Candidate ${id}`,
    total_experience_years: 0,
    added_at: '2026-07-30T09:00:00Z',
  };
}

function pages(...given: PoolPage[]) {
  const asked: (string | null)[] = [];
  const read = vi.fn(async (cursor: string | null) => {
    asked.push(cursor);
    return given[asked.length - 1] ?? { items: [] };
  });
  return { read, asked };
}

describe('reading the whole talent pool', () => {
  it('asks for the newest page first', async () => {
    const { read, asked } = pages({ items: [saved('a')], next_cursor: null });

    expect(await readWholePool(read)).toEqual([saved('a')]);
    expect(asked).toEqual([null]);
  });

  it('follows the cursor until the API stops giving one, keeping the pool’s own order', async () => {
    const { read, asked } = pages(
      { items: [saved('a'), saved('b')], next_cursor: 'after-b' },
      { items: [saved('c')], next_cursor: 'after-c' },
      { items: [saved('d')], next_cursor: null },
    );

    expect(await readWholePool(read)).toEqual([saved('a'), saved('b'), saved('c'), saved('d')]);
    expect(asked).toEqual([null, 'after-b', 'after-c']);
  });

  it('treats a page with no cursor at all as the last one', async () => {
    const { read, asked } = pages({ items: [saved('a')] });

    expect(await readWholePool(read)).toEqual([saved('a')]);
    expect(asked).toEqual([null]);
  });

  it('stops rather than looping when the API hands back a cursor it already gave', async () => {
    const { read, asked } = pages(
      { items: [saved('a')], next_cursor: 'stuck' },
      { items: [saved('b')], next_cursor: 'stuck' },
    );

    expect(await readWholePool(read)).toEqual([saved('a'), saved('b')]);
    expect(asked).toEqual([null, 'stuck']);
  });

  it('reads a bounded number of pages, however many the API offers', async () => {
    let issued = 0;
    const read = vi.fn(async () => {
      issued += 1;
      return { items: [saved(`c${issued}`)], next_cursor: `cursor-${issued}` };
    });

    const pool = await readWholePool(read);

    expect(read).toHaveBeenCalledTimes(MAX_POOL_PAGES);
    expect(pool).toHaveLength(MAX_POOL_PAGES);
  });
});
