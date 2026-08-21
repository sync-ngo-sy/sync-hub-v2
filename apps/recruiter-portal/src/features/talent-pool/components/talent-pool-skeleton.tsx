import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { POOL_COLUMNS } from './talent-pool-page';

export function TalentPoolSkeleton() {
  return (
    <RouteSkeleton label="Loading your talent pool">
      <WorkspaceHeader>
        <PageHeaderSkeleton />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton />
        <TableSkeleton columns={POOL_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
