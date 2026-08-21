import { createFileRoute } from '@tanstack/react-router';
import { PlatformTenants } from '@/features/platform/tenants';
import { PlatformTenantsSkeleton } from '@/features/platform/tenants-skeleton';

export const Route = createFileRoute('/_admin/tenants')({
  pendingComponent: PlatformTenantsSkeleton,
  component: PlatformTenants,
});
