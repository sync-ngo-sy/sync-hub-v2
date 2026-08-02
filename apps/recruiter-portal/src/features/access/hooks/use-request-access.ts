import { api } from '@/lib/api';

export function useRequestAccess() {
  return api.useMutation('post', '/v1/access-requests');
}
