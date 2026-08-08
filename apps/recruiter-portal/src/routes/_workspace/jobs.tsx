import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { JobsPage as JobsFeaturePage } from '@/features/jobs/components/jobs-page';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { DEFAULT_JOB_SORT } from '@/features/jobs/job';
import { warmLocations } from '@/features/reference/reference-queries';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

const jobStatus = z.enum(['draft', 'published', 'closed', 'archived']);
const jobSort = z.enum(['newest', 'oldest', 'applications']);

export const Route = createFileRoute('/_workspace/jobs')({
  validateSearch: z.object({ status: jobStatus.optional(), sort: jobSort.optional() }),
  loaderDeps: ({ search }) => ({ status: search.status, sort: search.sort }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient
        .ensureQueryData(jobsFirstPageQuery(deps.status, deps.sort))
        .catch(() => undefined),
      warmLocations(context.queryClient),
    ]),
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { status, sort } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Jobs">
      <JobsFeaturePage
        status={status}
        sort={sort}
        onJobOpen={(job) =>
          void navigate({ to: '/jobs/$jobId', params: { jobId: job.id }, search: {} })
        }
        onStatusChange={(nextStatus) =>
          void navigate({ search: (prev) => ({ ...prev, status: nextStatus }), replace: true })
        }
        onSortChange={(nextSort) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              sort: nextSort === DEFAULT_JOB_SORT ? undefined : nextSort,
            }),
            replace: true,
          })
        }
      />
    </WidgetBoundary>
  );
}
