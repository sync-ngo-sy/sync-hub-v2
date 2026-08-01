import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const myProfileQuery = api.queryOptions('get', '/v1/candidates/me/profile');

/** Both halves of the review: what the CV says, and what the profile says today. Neither is
 * fetched until the reader opens the review. */
export function useProfileDraft(cvId: string | null) {
  const draft = api.useQuery(
    'get',
    '/v1/candidates/me/cvs/{cv_id}/profile-draft',
    { params: { path: { cv_id: cvId ?? '' } } },
    { enabled: cvId !== null },
  );
  const profile = api.useQuery('get', '/v1/candidates/me/profile', undefined, {
    enabled: cvId !== null,
  });

  return { draft, profile };
}

export function useApplyDraft() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/candidates/me/profile', {
    onSuccess: (profile) => queryClient.setQueryData(myProfileQuery.queryKey, profile),
  });
}
