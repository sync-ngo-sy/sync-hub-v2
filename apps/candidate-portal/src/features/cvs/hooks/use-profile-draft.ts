import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const myProfileQuery = api.queryOptions('get', '/v1/candidates/me/profile');

/** Neither half is fetched until the reader opens the review. */
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

  // Handled inline in the dialog rather than by a boundary, so it reaches the seam here (§7.2).
  const error = draft.error ?? profile.error;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Profile draft' });
  }, [error]);

  return { draft, profile };
}

export function useApplyDraft() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/candidates/me/profile', {
    onSuccess: (profile) => queryClient.setQueryData(myProfileQuery.queryKey, profile),
  });
}
