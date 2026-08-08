import type { components } from '@sync/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MatchedCandidate } from '../candidate';
import { type CandidateSearchFilters, isAsked, searchQuery } from '../search';

type CandidateMatches = components['schemas']['CandidateMatches'];

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

export function cachedSearchHits(
  queryClient: QueryClient,
  filters: CandidateSearchFilters,
): MatchedCandidate[] {
  if (!isAsked(filters)) return [];

  const matches = queryClient.getQueryData<CandidateMatches>(
    candidateSearchQuery(filters).queryKey,
  );
  return matches?.items ?? [];
}
