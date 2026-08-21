import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type Problem = components['schemas']['ProblemDetail'];
type Tenant = components['schemas']['TenantView'];

export function belongsToTenant(tenant: Tenant) {
  return [http.get('/v1/tenants/me', ({ response }) => response(200).json(tenant))];
}

export function failsToReadTenant(problem: Problem) {
  return [http.get('/v1/tenants/me', ({ response }) => response(500).json(problem))];
}

export function refusesTenantAccess(problem: Problem) {
  return [http.get('/v1/tenants/me', ({ response }) => response(403).json(problem))];
}

export function savesLogo(
  tenant: Tenant,
  logoUrl: string,
  onUpload?: (contentType: string | null) => void,
) {
  let saved: string | null = tenant.logo_url ?? null;
  return [
    http.get('/v1/tenants/me', ({ response }) =>
      response(200).json({ ...tenant, logo_url: saved }),
    ),
    http.put('/v1/tenants/me/logo', ({ request, response }) => {
      onUpload?.(request.headers.get('content-type'));
      saved = logoUrl;
      return response(200).json({ logo_url: logoUrl });
    }),
  ];
}

export function refusesLogo(problem: Problem, status: 403 | 413 | 415) {
  return [http.put('/v1/tenants/me/logo', ({ response }) => response(status).json(problem))];
}
