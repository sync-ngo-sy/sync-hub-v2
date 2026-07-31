import type { components } from '@sync/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';

export type Profile = components['schemas']['ProfileView'];

/** Auth state is this query and nothing else — the session itself is an HttpOnly cookie. */
export const currentProfileQuery = api.queryOptions('get', '/v1/auth/me');

/** `null` is an answer, not a failure: it means nobody is signed in. */
export async function ensureCurrentProfile(queryClient: QueryClient): Promise<Profile | null> {
  try {
    return await queryClient.ensureQueryData(currentProfileQuery);
  } catch (error) {
    if (problemStatus(error) === 401) return null;
    throw error;
  }
}

export function rememberCurrentProfile(queryClient: QueryClient, profile: Profile): void {
  queryClient.setQueryData(currentProfileQuery.queryKey, profile);
}
