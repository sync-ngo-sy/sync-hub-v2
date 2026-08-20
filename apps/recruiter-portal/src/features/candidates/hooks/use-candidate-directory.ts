import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SearchableCandidate } from '../candidate';
import type { CandidatesReading } from '../reading';
import { directoryQuery } from '../search';

export const DIRECTORY_PATH = '/v1/directory/candidates';

function directoryInit(reading: CandidatesReading) {
  return { params: { query: directoryQuery(reading) } };
}

export function candidateDirectoryQuery(reading: CandidatesReading) {
  return api.queryOptions('get', DIRECTORY_PATH, directoryInit(reading));
}

export function useCandidateDirectory(reading: CandidatesReading) {
  return api.useQuery('get', DIRECTORY_PATH, directoryInit(reading));
}

/** The Candidate view has no by-id read yet, so it reconstructs a person from the list that found
 * them — the directory answers that for the Filter tab exactly as the ranking does for the other. */
export async function readDirectoryHits(
  queryClient: QueryClient,
  reading: CandidatesReading,
): Promise<SearchableCandidate[]> {
  const page = await queryClient
    .ensureQueryData(candidateDirectoryQuery(reading))
    .catch(() => null);
  return page?.items ?? [];
}
