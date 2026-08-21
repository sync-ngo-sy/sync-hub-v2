import { RouteSkeleton } from '@sync/ui/components/skeletons';
import { StatBandSkeleton } from '@sync/ui/components/stat-band';
import { OVERVIEW_TITLE, PLATFORM_COUNT_LABELS } from './platform-counts';

export function PlatformOverviewSkeleton() {
  return (
    <section>
      <h1 className="font-heading text-h2">{OVERVIEW_TITLE}</h1>
      <RouteSkeleton label="Loading the platform counts" className="mt-(--space-section)">
        <StatBandSkeleton labels={PLATFORM_COUNT_LABELS} />
      </RouteSkeleton>
    </section>
  );
}
