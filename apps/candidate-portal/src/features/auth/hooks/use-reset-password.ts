import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useResetPassword() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/auth/password-reset/confirm', {
    onSuccess: () => queryClient.clear(),
  });
}
