import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * Revokes every session the caller has, then lands on the landing page. The cache is cleared
 * only after the navigation, so no guarded panel is left refetching without a session.
 */
export function useLogOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return api.useMutation('post', '/v1/auth/logout', {
    onSuccess: async () => {
      await router.navigate({ to: '/' });
      queryClient.clear();
      toast.success('Signed out');
    },
    onError: () => {
      toast.error("Couldn't sign you out. Check your connection and try again.");
    },
  });
}
