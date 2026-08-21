import { PageHeaderSkeleton, RouteSkeleton, TableSkeleton } from '@sync/ui/components/skeletons';
import { TENANT_COLUMNS } from './tenants';

export function PlatformTenantsSkeleton() {
  return (
    <RouteSkeleton label="Loading the tenants">
      <PageHeaderSkeleton action />
      <TableSkeleton columns={TENANT_COLUMNS.length} className="mt-8" />
    </RouteSkeleton>
  );
}
