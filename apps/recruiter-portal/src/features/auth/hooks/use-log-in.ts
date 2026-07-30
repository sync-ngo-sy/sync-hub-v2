import { useQueryClient } from '@tanstack/react-query';
import { api, currentProfileOptions } from '@/lib/api';

/**
 * Seeds the profile query from the response so the guard that runs immediately after does
 * not make a second round trip to learn who just signed in.
 */
export function useLogIn() {
  const queryClient = useQueryClient();
  return api.useMutation('post', '/v1/auth/login', {
    onSuccess: (profile) => {
      queryClient.setQueryData(currentProfileOptions.queryKey, profile);
    },
  });
}
