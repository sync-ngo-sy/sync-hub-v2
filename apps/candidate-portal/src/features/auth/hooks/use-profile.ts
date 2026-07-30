import { api } from '../../../lib/api-client';

export function useProfile() {
  return api.useQuery('get', '/v1/auth/me', undefined, {
    retry: false,
    throwOnError: false,
  });
}
