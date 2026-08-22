import { api } from '@/lib/api';

export const CANDIDATE_PLACEMENTS_PATH = '/v1/tenants/me/candidates/{candidate_id}/placements';

export function useCandidatePlacements(candidateId: string) {
  return api.useQuery('get', CANDIDATE_PLACEMENTS_PATH, {
    params: { path: { candidate_id: candidateId } },
  });
}
