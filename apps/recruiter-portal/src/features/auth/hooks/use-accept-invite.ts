import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { rememberCurrentProfile } from '../current-profile';

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/auth/accept-invite', {
    onSuccess: (profile) => rememberCurrentProfile(queryClient, profile),
  });
}
