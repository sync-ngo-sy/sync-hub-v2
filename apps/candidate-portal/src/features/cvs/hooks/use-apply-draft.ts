import { useQueryClient } from '@tanstack/react-query';
import { api, profileQueryOptions } from '../../../lib/api-client';
import type { CandidateProfile } from '../draft';

const myProfileQueryOptions = api.queryOptions('get', '/v1/candidates/me/profile');

export function useApplyDraft() {
  const queryClient = useQueryClient();
  const mutation = api.useMutation('put', '/v1/candidates/me/profile', {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myProfileQueryOptions.queryKey });
      queryClient.invalidateQueries({ queryKey: profileQueryOptions.queryKey });
    },
  });

  function applyDraft(profile: CandidateProfile) {
    return mutation.mutateAsync({ body: profile });
  }

  return { applyDraft, mutation };
}
