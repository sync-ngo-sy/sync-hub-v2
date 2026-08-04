import { type QueryClient, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, client } from '@/lib/api';
import {
  POOL_LIST_PAGE_SIZE,
  POOL_PAGE_SIZE,
  type PooledCandidate,
  type PoolPage,
  readWholePool,
} from '../pool';

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

function listParams(cursor?: string | null) {
  return { params: { query: { limit: POOL_LIST_PAGE_SIZE, cursor } } };
}

export function talentPoolFirstPageQuery() {
  return api.queryOptions('get', POOL_PATH, listParams(null));
}

/** Every paged read of the pool, whatever cursor it stopped at. */
function talentPoolListPrefix() {
  return talentPoolFirstPageQuery().queryKey.slice(0, 2);
}

/** Settled rather than awaited: a page that will not load is the list's own to report. */
export function warmTalentPoolFirstPage(queryClient: QueryClient): Promise<PoolPage | undefined> {
  return queryClient.ensureQueryData(talentPoolFirstPageQuery()).catch(() => undefined);
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

/**
 * The pool as a list rather than as an answer about one Candidate: paged the way the API pages
 * it, because a page is what the list shows and the whole pool is only ever needed to say
 * whether somebody is in it.
 */
export function useSavedCandidates() {
  const queryClient = useQueryClient();
  const firstPageQuery = talentPoolFirstPageQuery();
  const firstPage = queryClient.getQueryData<PoolPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  return api.useInfiniteQuery('get', POOL_PATH, listParams(), {
    initialPageParam: null,
    getNextPageParam: (page: PoolPage) => page.next_cursor,
    select: (data: { pages: PoolPage[] }) => data.pages.flatMap((page) => page.items),
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

  // Both readings of one pool: the whole copy the save buttons answer from, and the pages the
  // talent pool page shows. A change to either is a change to both — and `all` rather than the
  // default because the copy nobody is watching is the one a route loader reads next, and
  // `ensureQueryData` hands back stale data rather than waiting for it to be re-read.
  const reread = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: talentPoolQuery.queryKey,
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({ queryKey: talentPoolListPrefix(), refetchType: 'all' }),
    ]);

  const save = api.useMutation('put', POOL_ENTRY_PATH, { onSuccess: reread });
  const drop = api.useMutation('delete', POOL_ENTRY_PATH, { onSuccess: reread });

  return {
    save: (candidateId) => save.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    drop: (candidateId) => drop.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    isChanging: save.isPending || drop.isPending,
  };
}
