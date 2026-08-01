import { api } from '@/lib/api';

export function useRequestPasswordReset() {
  return api.useMutation('post', '/v1/auth/password-reset');
}
