import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import type { ApplicationSummary } from '@/features/applications/application';
import {
  applicationsAddress,
  jobApplicationsAddress,
  jobApplicationsReading,
} from '@/features/applications/reading';
import {
  JobDetailPage,
  type JobDetailTab,
  JobNotFound,
} from '@/features/jobs/components/job-detail-page';
import { JobDetailSkeleton } from '@/features/jobs/components/job-detail-skeleton';
import { ensureJob } from '@/features/jobs/hooks/use-job';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { originAddress } from '@/features/shell/origin';
import { pageTitle } from '@/lib/page-title';

const jobTab = z.enum(['applications', 'criteria', 'links']);

export const Route = createFileRoute('/_workspace/jobs_/$jobId')({
  validateSearch: jobApplicationsReading.extend({
    tab: jobTab.optional().catch(undefined),
  }),
  loader: async ({ context, params }) => {
    const [job] = await Promise.all([
      ensureJob(context.queryClient, params.jobId),
      warmReferenceData(context.queryClient),
    ]);
    return job;
  },
  head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? 'Job') }] }),
  pendingComponent: JobDetailSkeleton,
  component: JobRoute,
});

function JobRoute() {
  const job = Route.useLoaderData();
  const { jobId } = Route.useParams();
  const { tab = 'applications', ...filters } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const applicationLocation = (application: ApplicationSummary) => ({
    to: '/applications/$applicationId' as const,
    params: { applicationId: application.id },
    search: { ...applicationsAddress(filters), from: originAddress({ at: 'job' }) },
  });

  if (!job) return <JobNotFound />;

  return (
    <JobDetailPage
      jobId={jobId}
      tab={tab}
      onTabChange={(nextTab: JobDetailTab) =>
        void navigate({ search: (prev) => ({ ...prev, tab: nextTab }), replace: true })
      }
      filters={filters}
      onFiltersChange={(next) =>
        void navigate({
          search: (prev) => ({ ...prev, ...jobApplicationsAddress(next) }),
          resetScroll: false,
        })
      }
      onApplicationOpen={(application) => void navigate(applicationLocation(application))}
      applicationHref={(application) => router.buildLocation(applicationLocation(application)).href}
    />
  );
}
