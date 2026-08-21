import {
  FactGridSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  TabStripSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { JOB_APPLICATION_COLUMNS } from '@/features/applications/components/job-applications';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { JOB_DETAIL_TABS } from './job-detail-page';

export function JobDetailSkeleton() {
  return (
    <RouteSkeleton label="Loading this Job">
      <WorkspaceHeader withTabs>
        <Skeleton className="h-4 w-48" aria-hidden="true" />
        <PageHeaderSkeleton className="mt-5" action />
        <FactGridSkeleton facts={5} className="mt-5" />
        <TabStripSkeleton tabs={JOB_DETAIL_TABS.length} className="-mb-px mt-5" />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton controls={1} />
        <TableSkeleton columns={JOB_APPLICATION_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
