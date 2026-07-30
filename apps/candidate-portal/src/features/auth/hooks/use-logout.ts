import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../../../lib/api-client';
import { setAuthenticated } from '../../../lib/session';

export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = api.useMutation('post', '/v1/auth/logout');

  return async () => {
    await mutation.mutateAsync(undefined);
    setAuthenticated(false);
    queryClient.clear();
    await navigate({ to: '/' });
  };
}
