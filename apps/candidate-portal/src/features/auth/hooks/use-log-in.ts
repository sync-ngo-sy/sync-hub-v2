import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { rememberCurrentProfile } from '../current-profile';

export function useLogIn() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/auth/login', {
    onSuccess: (profile) => rememberCurrentProfile(queryClient, profile),
  });
}
