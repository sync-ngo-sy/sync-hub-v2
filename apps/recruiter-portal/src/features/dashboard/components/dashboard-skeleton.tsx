import { CardSkeleton, PageHeaderSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';
import { StatBandSkeleton } from '@sync/ui/components/stat-band';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { STAT_LABELS } from '../dashboard';

export function DashboardSkeleton() {
  return (
    <RouteSkeleton label="Loading your dashboard">
      <WorkspaceHeader>
        <PageHeaderSkeleton action />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <StatBandSkeleton labels={STAT_LABELS} variant="cards" />

        <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
          <CardSkeleton lines={5} />

          <div className="space-y-(--space-grid)">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      </div>
    </RouteSkeleton>
  );
}
