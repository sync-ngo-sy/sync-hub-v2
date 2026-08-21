import { CardSkeleton, PageHeaderSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';

export function AccountSettingsSkeleton() {
  return (
    <RouteSkeleton label="Loading your account settings" className="space-y-(--space-section)">
      <WorkspaceHeader>
        <PageHeaderSkeleton />
      </WorkspaceHeader>

      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
    </RouteSkeleton>
  );
}
