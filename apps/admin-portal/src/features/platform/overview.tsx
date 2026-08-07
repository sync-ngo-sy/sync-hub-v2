import { StatBand } from '@sync/ui/components/stat-band';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const platformOverviewQuery = api.queryOptions('get', '/v1/platform/overview');

const statLabels = [
  ['tenants', 'Tenants'],
  ['candidates', 'Candidates'],
  ['jobs', 'Jobs'],
  ['applications', 'Applications'],
] as const;

export function PlatformOverview() {
  const { data } = useQuery(platformOverviewQuery);

  return (
    <section>
      <h1 className="font-heading text-h2">Platform overview</h1>
      {data ? (
        <StatBand
          className="mt-(--space-section)"
          items={statLabels.map(([key, label]) => ({ label, value: data[key] }))}
        />
      ) : null}
    </section>
  );
}
