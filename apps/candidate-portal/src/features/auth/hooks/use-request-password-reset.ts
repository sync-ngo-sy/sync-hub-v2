import { api } from '@/lib/api';

/** Accepted whether or not the address has an account — the answer never says which. */
export function useRequestPasswordReset() {
  return api.useMutation('post', '/v1/auth/password-reset');
}
