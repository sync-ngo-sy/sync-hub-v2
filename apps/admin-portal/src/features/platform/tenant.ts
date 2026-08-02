import type { components } from '@sync/api-client';

export type PlatformTenant = components['schemas']['PlatformTenantView'];

export function tenantPlanLabel(plan: PlatformTenant['plan']): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
