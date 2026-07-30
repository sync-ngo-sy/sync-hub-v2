import type { components } from '@sync/api-client/schema';
import type { QueryClient } from '@tanstack/react-query';
import { currentProfileOptions } from '@/lib/api';
import { isUnauthorized } from '@/lib/problem';

export type Profile = components['schemas']['ProfileView'];

/** `null` is "no session"; every other failure rethrows rather than implying a sign-out. */
export async function ensureCurrentProfile(queryClient: QueryClient): Promise<Profile | null> {
  try {
    return await queryClient.ensureQueryData(currentProfileOptions);
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}
