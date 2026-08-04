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
