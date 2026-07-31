import { api } from '../../../lib/api-client';

/** Shared so the route loader, the editor query, and the save mutation all agree on the cache key. */
export const myProfileQueryOptions = api.queryOptions('get', '/v1/candidates/me/profile');

export function useMyProfile() {
  return api.useQuery('get', '/v1/candidates/me/profile');
}
