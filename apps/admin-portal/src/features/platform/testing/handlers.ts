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

export const ACCESS_REQUESTS: components['schemas']['AccessRequestView'][] = [];

export function respondsWithAccessRequests(
  requests: components['schemas']['AccessRequestView'][] = ACCESS_REQUESTS,
) {
  return [http.get('/v1/platform/access-requests', ({ response }) => response(200).json(requests))];
}

export function convertsAccessRequest(
  created: components['schemas']['CreatedTenantView'],
  onRequest?: (slug: string) => void,
) {
  return [
    http.post('/v1/platform/access-requests/{request_id}/tenant', async ({ request, response }) => {
      const body = (await request.json()) as { slug: string };
      onRequest?.(body.slug);
      return response(201).json(created);
    }),
  ];
}

export function refusesConversion(problem: components['schemas']['ProblemDetail']) {
  return [
    http.post('/v1/platform/access-requests/{request_id}/tenant', ({ response }) =>
      response(409).json(problem),
    ),
  ];
}

export function dismissesAccessRequest(
  request: components['schemas']['AccessRequestView'],
  onRequest?: () => void,
) {
  return [
    http.post('/v1/platform/access-requests/{request_id}/dismissal', ({ response }) => {
      onRequest?.();
      return response(200).json(request);
    }),
  ];
}
