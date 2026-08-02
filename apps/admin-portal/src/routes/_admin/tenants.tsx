import { createFileRoute } from '@tanstack/react-router';
import { PlatformTenants } from '@/features/platform/tenants';

export const Route = createFileRoute('/_admin/tenants')({
  component: PlatformTenants,
});
