import { api } from '@/lib/api';

export const myProfileQuery = api.queryOptions('get', '/v1/candidates/me/profile');

export function useMyProfile() {
  return api.useSuspenseQuery('get', '/v1/candidates/me/profile');
}
