import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { api, client } from '@/lib/api';
import {
  POOL_PAGE_SIZE,
  type PooledCandidate,
  type PoolReading,
  poolQuery,
  readWholePool,
} from './pool';

export const POOL_PATH = '/v1/tenants/me/talent-pool';
export const POOL_ENTRY_PATH = '/v1/tenants/me/talent-pool/{candidate_id}';

export const SAVED_PAGE_SIZE = 20;

function everyPoolReading() {
  return ['get', POOL_PATH] as const;
}

export function wholePool() {
  return queryOptions({
    queryKey: [...everyPoolReading(), 'whole'] as const,
    queryFn: (): Promise<PooledCandidate[]> =>
      readWholePool(async (cursor) => {
        const { data, error } = await client.GET(POOL_PATH, {
          params: { query: { cursor, limit: POOL_PAGE_SIZE } },
        });
        if (error) throw error;
        return data;
      }),
  });
}

export function savedCandidatesPage(reading: PoolReading, cursor?: string | null) {
  return { params: { query: { ...poolQuery(reading), limit: SAVED_PAGE_SIZE, cursor } } };
}

export function savedCandidatesFirstPage(reading: PoolReading) {
  return api.queryOptions('get', POOL_PATH, savedCandidatesPage(reading, null));
}

export function useRereadTalentPool() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyPoolReading(), refetchType: 'all' });
}
