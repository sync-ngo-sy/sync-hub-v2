import type { Profile } from '@/features/auth/current-profile';

export function portalDestination(profile: Profile, returnTo?: string | null): string {
  if (profile.account_type !== 'platform_admin') return '/wrong-portal';
  return returnTo ?? '/overview';
}
