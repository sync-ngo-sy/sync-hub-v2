import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { DashboardPage as DashboardFeaturePage } from '@/features/dashboard/components/dashboard-page';
import type { TenantApplication } from '@/features/dashboard/dashboard';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { warmLocations } from '@/features/reference/reference-queries';
import { originAddress } from '@/features/shell/origin';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/dashboard')({
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
  const router = useRouter();
  const { profile } = Route.useRouteContext();
  const applicationLocation = (application: TenantApplication) => ({
    to: '/applications/$applicationId' as const,
    params: { applicationId: application.id },
    search: { from: originAddress({ at: 'dashboard' }) },
  });

  return (
    <DashboardFeaturePage
      recruiterName={profile.full_name}
      onJobOpen={(job) =>
        void navigate({ to: '/jobs/$jobId', params: { jobId: job.id }, search: {} })
      }
      onApplicationOpen={(application) => void navigate(applicationLocation(application))}
      applicationHref={(application) => router.buildLocation(applicationLocation(application)).href}
      onCreateJob={() => void navigate({ to: '/jobs/new', search: {} })}
    />
  );
}
