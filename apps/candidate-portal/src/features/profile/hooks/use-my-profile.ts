import { api } from '@/lib/api';

export const myProfileQuery = api.queryOptions('get', '/v1/candidates/me/profile');

/** The route's loader has already awaited this, so the form never renders half a profile. */
export function useMyProfile() {
  return api.useSuspenseQuery('get', '/v1/candidates/me/profile');
}
