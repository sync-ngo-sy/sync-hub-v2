import { useQueryClient } from '@tanstack/react-query';
import { api, currentProfileOptions } from '@/lib/api';

export function useLogIn() {
  const queryClient = useQueryClient();
  return api.useMutation('post', '/v1/auth/login', {
    // Seeded so the guard that runs straight after does not re-ask who just signed in.
    onSuccess: (profile) => {
      queryClient.setQueryData(currentProfileOptions.queryKey, profile);
    },
  });
}
