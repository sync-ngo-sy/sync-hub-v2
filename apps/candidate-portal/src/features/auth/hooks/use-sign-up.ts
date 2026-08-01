import { api } from '@/lib/api';

export function useSignUp() {
  return api.useMutation('post', '/v1/auth/signup');
}
