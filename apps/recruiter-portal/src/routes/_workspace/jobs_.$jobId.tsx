import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { PIPELINE_STATUSES, QUALIFICATION_STATUSES } from '@/features/applications/application';
import type { ApplicationFilters } from '@/features/applications/hooks/use-job-applications';
import {
  JobDetailPage,
  type JobDetailTab,
  JobNotFound,
} from '@/features/jobs/components/job-detail-page';
import { ensureJob } from '@/features/jobs/hooks/use-job';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { pageTitle } from '@/lib/page-title';

const jobTab = z.enum(['applications', 'criteria', 'links']);
const applicationStatus = z.enum(PIPELINE_STATUSES);
const qualificationStatus = z.enum(QUALIFICATION_STATUSES);

export const Route = createFileRoute('/_workspace/jobs_/$jobId')({
  validateSearch: z.object({
    tab: jobTab.optional().catch(undefined),
    status: applicationStatus.optional().catch(undefined),
    qualification: qualificationStatus.optional().catch(undefined),
  }),
  loader: async ({ context, params }) => {
    const [job] = await Promise.all([
      ensureJob(context.queryClient, params.jobId),
      warmReferenceData(context.queryClient),
    ]);
    return job;
  },
  head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? 'Job') }] }),
  component: JobRoute,
});

function JobRoute() {
  const job = Route.useLoaderData();
  const { jobId } = Route.useParams();
  const { tab = 'applications', status, qualification } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  if (!job) return <JobNotFound />;

  return (
    <JobDetailPage
      jobId={jobId}
      tab={tab}
      onTabChange={(nextTab: JobDetailTab) =>
        void navigate({ search: (prev) => ({ ...prev, tab: nextTab }), replace: true })
      }
      filters={{ status, qualification }}
      onFiltersChange={(filters: ApplicationFilters) =>
        void navigate({ search: (prev) => ({ ...prev, ...filters }) })
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
