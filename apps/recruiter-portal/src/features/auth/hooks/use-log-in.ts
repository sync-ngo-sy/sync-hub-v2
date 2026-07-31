import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { rememberCurrentProfile } from '../current-profile';

/** The reply is the signed-in Profile, so the guard never has to ask again. */
export function useLogIn() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/auth/login', {
    onSuccess: (profile) => rememberCurrentProfile(queryClient, profile),
  });
}
