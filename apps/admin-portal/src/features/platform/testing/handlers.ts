import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

export const PLATFORM_OVERVIEW: components['schemas']['PlatformOverviewView'] = {
  tenants: 0,
  candidates: 0,
  jobs: 0,
  applications: 0,
};

export function respondsWithPlatformOverview(
  overview: components['schemas']['PlatformOverviewView'] = PLATFORM_OVERVIEW,
) {
  return [http.get('/v1/platform/overview', ({ response }) => response(200).json(overview))];
}
