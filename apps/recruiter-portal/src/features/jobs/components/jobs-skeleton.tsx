import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  TabStripSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { JOB_STATUS_VALUES } from '../job';
import { JOB_COLUMNS } from './jobs-page';

export function JobsSkeleton() {
  return (
    <RouteSkeleton label="Loading Jobs">
      <WorkspaceHeader withTabs>
        <PageHeaderSkeleton action />
        <TabStripSkeleton tabs={JOB_STATUS_VALUES.length + 1} className="-mb-px mt-5" />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton controls={2} />
        <TableSkeleton columns={JOB_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
