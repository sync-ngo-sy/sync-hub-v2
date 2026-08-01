import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { myProfileQuery } from './use-my-profile';

/** The reply is the whole saved profile, so it becomes the cached one — no refetch to confirm
 * what the API just said. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return api.useMutation('put', '/v1/candidates/me/profile', {
    onSuccess: (saved) => queryClient.setQueryData(myProfileQuery.queryKey, saved),
  });
}
