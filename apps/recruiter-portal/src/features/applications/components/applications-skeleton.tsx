import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { TENANT_APPLICATION_COLUMNS } from './applications-page';

export function ApplicationsSkeleton() {
  return (
    <RouteSkeleton label="Loading Applications">
      <WorkspaceHeader>
        <PageHeaderSkeleton />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton controls={2} />
        <TableSkeleton columns={TENANT_APPLICATION_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
