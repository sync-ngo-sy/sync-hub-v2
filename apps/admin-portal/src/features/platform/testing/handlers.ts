import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

export const PLATFORM_OVERVIEW: components['schemas']['PlatformOverviewView'] = {
  tenants: 0,
  candidates: 0,
  jobs: 0,
  applications: 0,
};

export const PLATFORM_TENANTS: components['schemas']['PlatformTenantView'][] = [];

export function respondsWithPlatformOverview(
  overview: components['schemas']['PlatformOverviewView'] = PLATFORM_OVERVIEW,
) {
  return [http.get('/v1/platform/overview', ({ response }) => response(200).json(overview))];
}

export function respondsWithPlatformTenants(
  tenants: components['schemas']['PlatformTenantView'][] = PLATFORM_TENANTS,
) {
  return [http.get('/v1/platform/tenants', ({ response }) => response(200).json(tenants))];
}

export function createsPlatformTenant(created: components['schemas']['CreatedTenantView']) {
  return [http.post('/v1/platform/tenants', ({ response }) => response(201).json(created))];
}

export function resendsFoundingAdminInvite(admin: components['schemas']['MemberView']) {
  return [
    http.post('/v1/platform/tenants/{tenant_id}/invite', ({ response }) =>
      response(200).json(admin),
    ),
  ];
}

export function setsPlatformTenantStatus(tenant: components['schemas']['PlatformTenantView']) {
  return [
    http.patch('/v1/platform/tenants/{tenant_id}', ({ response }) => response(200).json(tenant)),
  ];
}
