import { api } from '@/lib/api';

export function useChangePassword() {
  return api.useMutation('post', '/v1/auth/password');
}
