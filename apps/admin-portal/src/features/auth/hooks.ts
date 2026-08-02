import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { rememberCurrentProfile } from './current-profile';

export function useLogIn() {
  const queryClient = useQueryClient();
  return api.useMutation('post', '/v1/auth/login', {
    onSuccess: (profile) => rememberCurrentProfile(queryClient, profile),
  });
}

export function useLogOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return api.useMutation('post', '/v1/auth/logout', {
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/login', replace: true });
    },
  });
}

export function useRequestPasswordReset() {
  return api.useMutation('post', '/v1/auth/password-reset');
}

export function useResetPassword() {
  return api.useMutation('post', '/v1/auth/password-reset/confirm');
}
