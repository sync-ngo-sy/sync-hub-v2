import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SearchableCandidate } from '../candidate';
import {
  type CandidateSearchFilters,
  DEFAULT_ORDER,
  type DirectoryOrder,
  directoryQuery,
} from '../search';

export const DIRECTORY_PATH = '/v1/directory/candidates';

function directoryInit(filters: CandidateSearchFilters, order: DirectoryOrder) {
  return { params: { query: directoryQuery(filters, order) } };
}

export function candidateDirectoryQuery(filters: CandidateSearchFilters, order: DirectoryOrder) {
  return api.queryOptions('get', DIRECTORY_PATH, directoryInit(filters, order));
}

export function useCandidateDirectory(filters: CandidateSearchFilters, order: DirectoryOrder) {
  return api.useQuery('get', DIRECTORY_PATH, directoryInit(filters, order));
}

/** The Candidate view has no by-id read yet, so it reconstructs a person from the list that found
 * them — the directory answers that for the Filter tab exactly as the ranking does for the other. */
export async function readDirectoryHits(
  queryClient: QueryClient,
  filters: CandidateSearchFilters,
  order: DirectoryOrder = DEFAULT_ORDER,
): Promise<SearchableCandidate[]> {
  const page = await queryClient
    .ensureQueryData(candidateDirectoryQuery(filters, order))
    .catch(() => null);
  return page?.items ?? [];
}
