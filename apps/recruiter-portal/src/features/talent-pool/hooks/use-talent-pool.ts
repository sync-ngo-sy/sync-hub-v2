import { type QueryClient, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, client } from '@/lib/api';
import { POOL_PAGE_SIZE, type PooledCandidate, readWholePool } from '../pool';

export const POOL_PATH = '/v1/tenants/me/talent-pool';
export const POOL_ENTRY_PATH = '/v1/tenants/me/talent-pool/{candidate_id}';

export const talentPoolQuery = queryOptions({
  queryKey: ['talent-pool', 'whole'],
  queryFn: () =>
    readWholePool(async (cursor) => {
      const { data, error } = await client.GET(POOL_PATH, {
        params: { query: { cursor, limit: POOL_PAGE_SIZE } },
      });
      if (error) throw error;
      return data;
    }),
});

/** Settled rather than awaited: a pool that will not load is the pool card's to report. */
export function warmTalentPool(queryClient: QueryClient): Promise<PooledCandidate[]> {
  return queryClient.ensureQueryData(talentPoolQuery).catch(() => []);
}

export interface TalentPool {
  saved: PooledCandidate[];
  isPending: boolean;
  error: unknown;
  refetch: () => void;
  holds: (candidateId: string) => boolean;
}

export function useTalentPool(): TalentPool {
  const pool = useQuery(talentPoolQuery);
  const saved = pool.data ?? [];

  return {
    saved,
    isPending: pool.isPending,
    error: pool.isError ? pool.error : null,
    refetch: () => void pool.refetch(),
    holds: (candidateId) => saved.some((entry) => entry.candidate_id === candidateId),
  };
}

export interface TalentPoolActions {
  save: (candidateId: string) => Promise<unknown>;
  drop: (candidateId: string) => Promise<unknown>;
  isChanging: boolean;
}

export function useTalentPoolActions(): TalentPoolActions {
  const queryClient = useQueryClient();
  const reread = () => queryClient.invalidateQueries({ queryKey: talentPoolQuery.queryKey });

  const save = api.useMutation('put', POOL_ENTRY_PATH, { onSuccess: reread });
  const drop = api.useMutation('delete', POOL_ENTRY_PATH, { onSuccess: reread });

  return {
    save: (candidateId) => save.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    drop: (candidateId) => drop.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    isChanging: save.isPending || drop.isPending,
  };
}
