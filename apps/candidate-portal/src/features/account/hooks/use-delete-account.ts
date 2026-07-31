import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../../../lib/api-client';
import { setAuthenticated } from '../../../lib/session';

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = api.useMutation('post', '/v1/candidates/me/deletion');

  async function deleteAccount(password: string) {
    await mutation.mutateAsync({ body: { password } });
    // The account is gone and the session with it. Drop the latch first so the profile refetch's
    // 401 can't be mistaken for an expiry and bounce us to login instead of the farewell. Reset
    // rather than clear: it refetches the shell's mounted profile query in place — which now 401s,
    // flipping the header to signed-out — where clear() would orphan that observer on stale data.
    setAuthenticated(false);
    await queryClient.resetQueries();
    await navigate({ to: '/goodbye' });
  }

  return { deleteAccount, mutation };
}
