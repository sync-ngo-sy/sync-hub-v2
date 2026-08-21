import {
  PageHeaderSkeleton,
  RouteSkeleton,
  TableSkeleton,
  TabStripSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { DIRECTORY_COLUMNS } from './candidate-directory';
import { CANDIDATE_SEARCH_TABS } from './candidate-search-page';

export function CandidateSearchSkeleton() {
  return (
    <RouteSkeleton label="Loading Candidates">
      <WorkspaceHeader withTabs>
        <PageHeaderSkeleton />
        <TabStripSkeleton tabs={CANDIDATE_SEARCH_TABS.length} className="-mb-px mt-5" />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ToolbarSkeleton controls={3} />
        <TableSkeleton columns={DIRECTORY_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
