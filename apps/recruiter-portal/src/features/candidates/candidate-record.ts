import type { components } from '@sync/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';

export type CandidateRecord = components['schemas']['CandidateRecord'];

export const CANDIDATE_PATH = '/v1/directory/candidates/{candidate_id}';

export function candidateRecordQuery(candidateId: string) {
  return api.queryOptions('get', CANDIDATE_PATH, {
    params: { path: { candidate_id: candidateId } },
  });
}

export async function ensureCandidateRecord(
  queryClient: QueryClient,
  candidateId: string,
): Promise<CandidateRecord | null> {
  try {
    return await queryClient.ensureQueryData(candidateRecordQuery(candidateId));
  } catch (error) {
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
