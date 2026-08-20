import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MatchedCandidate } from '../candidate';
import type { CandidateSearchFilters } from '../reading';
import { isAsked, searchQuery } from '../search';

export const SEARCH_PATH = '/v1/search/candidates';

function searchInit(filters: CandidateSearchFilters) {
  return { params: { query: searchQuery(filters) } };
}

export function candidateSearchQuery(filters: CandidateSearchFilters) {
  return api.queryOptions('get', SEARCH_PATH, searchInit(filters));
}

export function useCandidateSearch(filters: CandidateSearchFilters) {
  return api.useQuery('get', SEARCH_PATH, searchInit(filters), { enabled: isAsked(filters) });
}

export async function readSearchHits(
  queryClient: QueryClient,
  filters: CandidateSearchFilters,
): Promise<MatchedCandidate[]> {
  if (!isAsked(filters)) return [];

  const matches = await queryClient
    .ensureQueryData(candidateSearchQuery(filters))
    .catch(() => null);
  return matches?.items ?? [];
}
