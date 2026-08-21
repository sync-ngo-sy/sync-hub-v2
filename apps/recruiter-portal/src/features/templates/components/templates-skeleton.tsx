import { PageHeaderSkeleton, RouteSkeleton, TableSkeleton } from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { TEMPLATE_COLUMNS } from './message-templates-page';

export function TemplatesSkeleton() {
  return (
    <RouteSkeleton label="Loading your Templates">
      <WorkspaceHeader>
        <PageHeaderSkeleton action />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <TableSkeleton columns={TEMPLATE_COLUMNS.length} />
      </div>
    </RouteSkeleton>
  );
}
