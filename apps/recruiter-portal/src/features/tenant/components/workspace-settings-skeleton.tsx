import {
  CardSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
  TabStripSkeleton,
} from '@sync/ui/components/skeletons';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { SETTINGS_TABS } from './workspace-settings-page';

export function WorkspaceSettingsSkeleton() {
  return (
    <RouteSkeleton label="Loading your workspace settings">
      <WorkspaceHeader withTabs>
        <PageHeaderSkeleton />
        <TabStripSkeleton tabs={SETTINGS_TABS.length} className="-mb-px mt-5" />
      </WorkspaceHeader>

      <div className="pt-(--space-section)">
        <CardSkeleton lines={5} />
      </div>
    </RouteSkeleton>
  );
}
