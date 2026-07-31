import { api } from '../../../lib/api-client';

export function useProfileDraft(cvId: string | null) {
  return api.useQuery(
    'get',
    '/v1/candidates/me/cvs/{cv_id}/profile-draft',
    { params: { path: { cv_id: cvId ?? '' } } },
    { enabled: cvId != null, retry: false },
  );
}
