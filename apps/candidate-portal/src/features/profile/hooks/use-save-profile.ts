import type { components } from '@sync/api-client/schema';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { myProfileQueryOptions } from './use-my-profile';

type CandidateProfile = components['schemas']['CandidateProfile'];

export function useSaveProfile() {
  const queryClient = useQueryClient();
  const mutation = api.useMutation('put', '/v1/candidates/me/profile');

  /** Replace the whole profile, then seed the cache with the server's canonical copy of it. */
  async function save(profile: CandidateProfile): Promise<CandidateProfile> {
    const saved = await mutation.mutateAsync({ body: profile });
    queryClient.setQueryData(myProfileQueryOptions.queryKey, saved);
    return saved;
  }

  return { save, mutation };
}
