import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useLogOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return api.useMutation('post', '/v1/auth/logout', {
    onSuccess: async () => {
      // Clearing before the navigation would leave guarded panels refetching without a session.
      await router.navigate({ to: '/' });
      queryClient.clear();
      toast.success('Signed out');
    },
    onError: () => {
      toast.error("Couldn't sign you out. Check your connection and try again.");
    },
  });
}
