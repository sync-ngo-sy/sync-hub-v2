import type { components } from '@sync/api-client/schema';
import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { profileQueryOptions } from './api-client';
import { errorStatus } from './errors';
import { setAuthenticated } from './session';

type Profile = components['schemas']['ProfileView'];

/**
 * Seed a freshly issued session into the cache: latch it as live and prime the profile query,
 * so the next guard reads a signed-in profile without a round-trip. Shared by every route that
 * ends holding a new session — login, email confirmation, password reset.
 */
export function establishSession(queryClient: QueryClient, profile: Profile): void {
  setAuthenticated(true);
  queryClient.setQueryData(profileQueryOptions.queryKey, profile);
}

/** Where an authenticated profile belongs: candidates in the app, anyone else on Wrong-portal. */
export function homePathFor(profile: Profile): '/applications' | '/wrong-portal' {
  return profile.account_type === 'candidate' ? '/applications' : '/wrong-portal';
}

/** A returnTo is honored only if it is a root-relative in-app path — never an external redirect. */
export function isSafeReturnTo(value: string): boolean {
  return /^\/(?![/\\])/.test(value);
}

/**
 * Auth state is `getCurrentProfile` alone. A 401 reads as "signed out"; any other failure
 * propagates so the route boundary shows a Retry card rather than silently bouncing to login.
 */
export async function loadProfile(queryClient: QueryClient): Promise<Profile | null> {
  try {
    const profile = await queryClient.ensureQueryData(profileQueryOptions);
    setAuthenticated(true);
    return profile;
  } catch (error) {
    if (errorStatus(error) === 401) return null;
    throw error;
  }
}

export async function requireCandidate(queryClient: QueryClient, returnTo: string) {
  const profile = await loadProfile(queryClient);
  if (!profile) {
    throw redirect({ to: '/login', search: { returnTo } });
  }
  if (profile.account_type !== 'candidate') {
    throw redirect({ to: '/wrong-portal' });
  }
  return profile;
}

export async function bounceIfAuthed(queryClient: QueryClient): Promise<void> {
  const profile = await loadProfile(queryClient);
  if (!profile) return;
  throw redirect({ to: homePathFor(profile) });
}
