import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Setting the password revokes every session, so whatever this tab held is gone with it. */
export function useResetPassword() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/auth/password-reset/confirm', {
    onSuccess: () => queryClient.clear(),
  });
}
