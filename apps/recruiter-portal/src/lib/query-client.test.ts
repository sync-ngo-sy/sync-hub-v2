import { describe, expect, it } from 'vitest';
import { createQueryClient } from './query-client';

const defaults = () => createQueryClient().getDefaultOptions();

describe('the agreed query defaults', () => {
  it('holds data fresh for 30 seconds', () => {
    expect(defaults().queries?.staleTime).toBe(30_000);
  });

  it('never retries a mutation', () => {
    expect(defaults().mutations?.retry).toBe(0);
  });

  it('retries a query once, but never one the caller got wrong', () => {
    const retry = defaults().queries?.retry;
    if (typeof retry !== 'function') throw new Error('expected a retry predicate');
    const failed = (status: number) => Object.assign(new Error('request failed'), { status });

    expect(retry(0, failed(503))).toBe(true);
    expect(retry(1, failed(503))).toBe(false);
    expect(retry(0, failed(404))).toBe(false);
    expect(retry(0, failed(401))).toBe(false);
  });
});
