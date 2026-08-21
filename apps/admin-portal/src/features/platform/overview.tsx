import { StatBand } from '@sync/ui/components/stat-band';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlatformOverviewSkeleton } from './overview-skeleton';
import { OVERVIEW_TITLE, PLATFORM_COUNTS } from './platform-counts';

export const platformOverviewQuery = api.queryOptions('get', '/v1/platform/overview');

export function PlatformOverview() {
  const { data } = useQuery(platformOverviewQuery);

  if (!data) return <PlatformOverviewSkeleton />;

  return (
    <section>
      <h1 className="font-heading text-h2">{OVERVIEW_TITLE}</h1>
      <StatBand
        className="mt-(--space-section)"
        items={PLATFORM_COUNTS.map(([key, label]) => ({ label, value: data[key] }))}
      />
    </section>
  );
}
