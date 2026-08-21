import { PageHeaderSkeleton, RouteSkeleton, TableSkeleton } from '@sync/ui/components/skeletons';
import { ACCESS_REQUEST_COLUMNS } from './access-requests';

export function AccessRequestsSkeleton() {
  return (
    <RouteSkeleton label="Loading the access requests">
      <PageHeaderSkeleton />
      <TableSkeleton columns={ACCESS_REQUEST_COLUMNS.length} className="mt-8" />
    </RouteSkeleton>
  );
}
