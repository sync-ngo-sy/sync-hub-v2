import { api } from '@/lib/api';

/** No session follows: the emailed confirmation link is what signs the candidate in. */
export function useSignUp() {
  return api.useMutation('post', '/v1/auth/signup');
}
