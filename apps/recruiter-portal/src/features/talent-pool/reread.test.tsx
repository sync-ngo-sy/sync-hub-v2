import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, type PoolReading } from './pool';
import { savedCandidatesFirstPage, useRereadTalentPool, wholePool } from './reread';

const LIST: PoolReading = { q: '', order: DEFAULT_ORDER };

function timesRead(queryClient: QueryClient, reading: { queryKey: readonly unknown[] }) {
  return queryClient.getQueryState(reading.queryKey)?.dataUpdateCount;
}

describe('the talent pool Re-read', () => {
  it('reaches the whole pool as well as the list', async () => {
    const queryClient = new QueryClient();
    await queryClient.ensureQueryData(wholePool());
    await queryClient.ensureQueryData(savedCandidatesFirstPage(LIST));

    const { result } = renderHook(() => useRereadTalentPool(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      await result.current();
    });

    expect(timesRead(queryClient, wholePool())).toBe(2);
    expect(timesRead(queryClient, savedCandidatesFirstPage(LIST))).toBe(2);
  });
});
