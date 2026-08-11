import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { problemMessage } from '@/lib/api-problem';

export function useLogOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return api.useMutation('post', '/v1/auth/logout', {
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/', replace: true });
    },
    onError: (error) => {
      toast.error(problemMessage(error, "Couldn't sign you out. Try again."));
    },
  });
}
