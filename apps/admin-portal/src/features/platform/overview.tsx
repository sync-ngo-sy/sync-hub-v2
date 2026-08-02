import { StatCard } from '@sync/ui/components/stat-card';
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
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statLabels.map(([key, label]) => (
            <StatCard key={key} label={label} value={data[key]} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
