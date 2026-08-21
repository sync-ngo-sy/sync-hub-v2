import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { PLACEMENT_COLUMNS } from './placements-page';

export function PlacementsSkeleton() {
  return (
    <RouteSkeleton label="Loading your Placements">
      <WorkspaceHeader>
        <PageHeaderSkeleton />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton controls={1} />
        <TableSkeleton columns={PLACEMENT_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
