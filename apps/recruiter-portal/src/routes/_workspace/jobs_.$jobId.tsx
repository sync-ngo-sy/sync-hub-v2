import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  JobDetailPage,
  type JobDetailTab,
  JobNotFound,
} from '@/features/jobs/components/job-detail-page';
import { ensureJob } from '@/features/jobs/hooks/use-job';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { pageTitle } from '@/lib/page-title';

const jobTab = z.enum(['applications', 'criteria', 'links']);

export const Route = createFileRoute('/_workspace/jobs_/$jobId')({
  validateSearch: z.object({ tab: jobTab.optional().catch(undefined) }),
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
  const { tab = 'applications' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  if (!job) return <JobNotFound />;

  return (
    <JobDetailPage
      jobId={jobId}
      tab={tab}
      onTabChange={(nextTab: JobDetailTab) =>
        void navigate({ search: { tab: nextTab }, replace: true })
      }
    />
  );
}
