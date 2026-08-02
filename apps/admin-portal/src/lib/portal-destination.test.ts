import { describe, expect, it } from 'vitest';
import { CANDIDATE, PLATFORM_ADMIN, RECRUITER } from '@/testing/fixtures';
import { portalDestination } from './portal-destination';

describe('portalDestination', () => {
  it('sends platform administrators to their requested destination or overview', () => {
    expect(portalDestination(PLATFORM_ADMIN)).toBe('/overview');
    expect(portalDestination(PLATFORM_ADMIN, '/tenants')).toBe('/tenants');
  });

  it.each([CANDIDATE, RECRUITER])('sends other account types to the wrong portal', (profile) => {
    expect(portalDestination(profile, '/tenants')).toBe('/wrong-portal');
  });
});
