import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PooledCandidate, PoolPage, PoolReading } from '../pool';
import {
  POOL_ENTRY_PATH,
  POOL_PATH,
  savedCandidatesFirstPage,
  savedCandidatesPage,
  useRereadTalentPool,
  wholePool,
} from '../reread';

export function warmTalentPool(queryClient: QueryClient): Promise<PooledCandidate[]> {
  return queryClient.ensureQueryData(wholePool()).catch(() => []);
}

export function warmSavedCandidates(
  queryClient: QueryClient,
  reading: PoolReading,
): Promise<PoolPage | undefined> {
  return queryClient.ensureQueryData(savedCandidatesFirstPage(reading)).catch(() => undefined);
}

export interface TalentPool {
  saved: PooledCandidate[];
  isPending: boolean;
  error: unknown;
  refetch: () => void;
  holds: (candidateId: string) => boolean;
}

export function useTalentPool(): TalentPool {
  const pool = useQuery(wholePool());
  const saved = pool.data ?? [];

  return {
    saved,
    isPending: pool.isPending,
    error: pool.isError ? pool.error : null,
    refetch: () => void pool.refetch(),
    holds: (candidateId) => saved.some((entry) => entry.candidate_id === candidateId),
  };
}

export function useSavedCandidates(reading: PoolReading) {
  const queryClient = useQueryClient();
  const firstPageQuery = savedCandidatesFirstPage(reading);
  const firstPage = queryClient.getQueryData<PoolPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  return api.useInfiniteQuery('get', POOL_PATH, savedCandidatesPage(reading), {
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
  const reread = useRereadTalentPool();

  const save = api.useMutation('put', POOL_ENTRY_PATH, { onSuccess: reread });
  const drop = api.useMutation('delete', POOL_ENTRY_PATH, { onSuccess: reread });

  return {
    save: (candidateId) => save.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    drop: (candidateId) => drop.mutateAsync({ params: { path: { candidate_id: candidateId } } }),
    isChanging: save.isPending || drop.isPending,
  };
}
