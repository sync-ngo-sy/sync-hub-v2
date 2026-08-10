import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { JobsPage as JobsFeaturePage } from '@/features/jobs/components/jobs-page';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import {
  DEFAULT_JOB_SORT,
  JOB_SORT_VALUES,
  JOB_STATUS_VALUES,
  type JobSummary,
} from '@/features/jobs/job';
import { warmLocations } from '@/features/reference/reference-queries';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

const jobStatus = z.enum(JOB_STATUS_VALUES);
const jobSort = z.enum(JOB_SORT_VALUES);

export const Route = createFileRoute('/_workspace/jobs')({
  validateSearch: z.object({
    q: z.string().trim().max(200).optional().catch(undefined),
    status: jobStatus.optional().catch(undefined),
    sort: jobSort.optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ q: search.q, status: search.status, sort: search.sort }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient
        .ensureQueryData(jobsFirstPageQuery(deps.status, deps.sort, deps.q))
        .catch(() => undefined),
      warmLocations(context.queryClient),
    ]),
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { q, status, sort } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const jobLocation = (job: JobSummary) => ({
    to: '/jobs/$jobId' as const,
    params: { jobId: job.id },
    search: {},
  });

  return (
    <WidgetBoundary name="Jobs">
      <JobsFeaturePage
        q={q}
        status={status}
        sort={sort}
        onQueryChange={(nextQuery) =>
          void navigate({ search: (prev) => ({ ...prev, q: nextQuery }), replace: true })
        }
        onJobOpen={(job) => void navigate(jobLocation(job))}
        jobHref={(job) => router.buildLocation(jobLocation(job)).href}
        onCreateJob={() => void navigate({ to: '/jobs/new', search: {} })}
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
