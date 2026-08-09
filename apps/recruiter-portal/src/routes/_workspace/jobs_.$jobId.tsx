import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { PIPELINE_STATUSES, SCREENING_VERDICTS } from '@/features/applications/application';
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
const pipelineStatuses = z.array(z.enum(PIPELINE_STATUSES)).min(1);
const screeningVerdicts = z.array(z.enum(SCREENING_VERDICTS)).min(1);

export const Route = createFileRoute('/_workspace/jobs_/$jobId')({
  validateSearch: z.object({
    tab: jobTab.optional().catch(undefined),
    pipeline: pipelineStatuses.optional().catch(undefined),
    screening: screeningVerdicts.optional().catch(undefined),
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
  const { tab = 'applications', pipeline, screening } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  if (!job) return <JobNotFound />;

  return (
    <JobDetailPage
      jobId={jobId}
      tab={tab}
      onTabChange={(nextTab: JobDetailTab) =>
        void navigate({ search: (prev) => ({ ...prev, tab: nextTab }), replace: true })
      }
      filters={{ pipeline, screening }}
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
