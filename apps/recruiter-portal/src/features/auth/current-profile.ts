import type { components } from '@sync/api-client/schema';
import type { QueryClient } from '@tanstack/react-query';
import { currentProfileOptions } from '@/lib/api';
import { isUnauthorized } from '@/lib/problem';

export type Profile = components['schemas']['ProfileView'];

/**
 * Auth state is this query and nothing else — sessions are HttpOnly cookies the app cannot
 * read. `null` means there is no valid session; anything else (a 500, an outage) is rethrown
 * so the route boundary offers a Retry instead of pretending the caller is signed out.
 */
export async function ensureCurrentProfile(queryClient: QueryClient): Promise<Profile | null> {
  try {
    return await queryClient.ensureQueryData(currentProfileOptions);
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
