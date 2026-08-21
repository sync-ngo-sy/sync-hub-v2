import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  TabStripSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { LINK_FILTER_ORDER } from '../tracked-link';
import { TRACKED_LINK_COLUMNS } from './tenant-tracked-links-page';

export function TrackedLinksSkeleton() {
  return (
    <RouteSkeleton label="Loading your Tracked links">
      <WorkspaceHeader withTabs>
        <PageHeaderSkeleton />
        <TabStripSkeleton tabs={LINK_FILTER_ORDER.length} className="-mb-px mt-5" />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton />
        <TableSkeleton columns={TRACKED_LINK_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
