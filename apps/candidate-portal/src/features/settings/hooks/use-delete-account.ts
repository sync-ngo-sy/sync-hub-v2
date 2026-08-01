import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '@/lib/api';

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return api.useMutation('post', '/v1/candidates/me/deletion', {
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/account-deleted', replace: true });
    },
  });
}
