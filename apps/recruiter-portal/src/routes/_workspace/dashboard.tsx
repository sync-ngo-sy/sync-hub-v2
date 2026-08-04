import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DashboardPage as DashboardFeaturePage } from '@/features/dashboard/components/dashboard-page';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { warmLocations } from '@/features/reference/reference-queries';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/dashboard')({
  // The counts and the recent Applications are deliberately not waited on here: each panel
  // carries its own skeleton, and a loader that blocked on them would hold the whole page back
  // for the slowest of the three reads.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(jobsFirstPageQuery()).catch(() => undefined),
      warmLocations(context.queryClient),
    ]),
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <DashboardFeaturePage
      onJobOpen={(job) =>
        void navigate({ to: '/jobs/$jobId', params: { jobId: job.id }, search: {} })
      }
      onApplicationOpen={(application) =>
        void navigate({
          to: '/applications/$applicationId',
          params: { applicationId: application.id },
        })
      }
    />
  );
}
