import { type QueryClient, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, client } from '@/lib/api';
import { POOL_PAGE_SIZE, type PooledCandidate, type PoolPage, readWholePool } from '../pool';

export const POOL_PATH = '/v1/tenants/me/talent-pool';
export const POOL_ENTRY_PATH = '/v1/tenants/me/talent-pool/{candidate_id}';

export const SAVED_PAGE_SIZE = 20;

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

export function warmTalentPool(queryClient: QueryClient): Promise<PooledCandidate[]> {
  return queryClient.ensureQueryData(talentPoolQuery).catch(() => []);
}

function savedParams(cursor?: string | null) {
  return { params: { query: { limit: SAVED_PAGE_SIZE, cursor } } };
}

export function savedCandidatesFirstPageQuery() {
  return api.queryOptions('get', POOL_PATH, savedParams(null));
}

function savedCandidatesPrefix() {
  return savedCandidatesFirstPageQuery().queryKey.slice(0, 2);
}

export function warmSavedCandidates(queryClient: QueryClient): Promise<PoolPage | undefined> {
  return queryClient.ensureQueryData(savedCandidatesFirstPageQuery()).catch(() => undefined);
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

export function useSavedCandidates() {
  const queryClient = useQueryClient();
  const firstPageQuery = savedCandidatesFirstPageQuery();
  const firstPage = queryClient.getQueryData<PoolPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  return api.useInfiniteQuery('get', POOL_PATH, savedParams(), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
    initialData: firstPage ? { pages: [firstPage], pageParams: [null] } : undefined,
    initialDataUpdatedAt: firstPageUpdatedAt,
  });
}

export interface TalentPoolActions {
  save: (candidateId: string) => Promise<unknown>;
  drop: (candidateId: string) => Promise<unknown>;
  isChanging: boolean;
}

export function useTalentPoolActions(): TalentPoolActions {
  const queryClient = useQueryClient();

  const reread = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: talentPoolQuery.queryKey, refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: savedCandidatesPrefix(), refetchType: 'all' }),
    ]);

  const save = api.useMutation('put', POOL_ENTRY_PATH, { onSuccess: reread });
  const drop = api.useMutation('delete', POOL_ENTRY_PATH, { onSuccess: reread });

  return {
    save: (candidateId) => save.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    drop: (candidateId) => drop.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    isChanging: save.isPending || drop.isPending,
  };
}
