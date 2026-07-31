import { MutationObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './query-client';

const SERVER_FAULT = { type: 'about:blank', title: 'Internal Server Error', status: 500 };
const NOT_FOUND = { type: 'about:blank', title: 'Not Found', status: 404 };

async function attempts(error: unknown): Promise<number> {
  const queryFn = vi.fn(() => Promise.reject(error));
  await createQueryClient()
    .fetchQuery({ queryKey: ['probe'], queryFn, retryDelay: 0 })
    .catch(() => undefined);
  return queryFn.mock.calls.length;
}

describe('the app query client', () => {
  it('retries a server fault once', async () => {
    await expect(attempts(SERVER_FAULT)).resolves.toBe(2);
  });

  it('never retries a client error, which a second try could not fix', async () => {
    await expect(attempts(NOT_FOUND)).resolves.toBe(1);
  });

  it('serves a repeat read from cache for thirty seconds', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn(() => Promise.resolve('cached'));

    await client.fetchQuery({ queryKey: ['probe'], queryFn });
    await client.fetchQuery({ queryKey: ['probe'], queryFn });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('never retries a mutation, so no write is ever sent twice', async () => {
    const mutationFn = vi.fn(() => Promise.reject(SERVER_FAULT));
    const observer = new MutationObserver(createQueryClient(), { mutationFn });

    await observer.mutate().catch(() => undefined);

    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});
