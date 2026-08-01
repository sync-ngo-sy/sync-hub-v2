import { createFileRoute, useLocation } from '@tanstack/react-router';
import { JobDetail } from '@/features/jobs/components/job-detail';
import { JobDetailSkeleton } from '@/features/jobs/components/job-detail-skeleton';
import { ClosedJob } from '@/features/jobs/components/job-gone';
import { ensureJob } from '@/features/jobs/job-queries';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_browse/jobs_/$jobId')({
  loader: ({ context, params }) => ensureJob(context.queryClient, params.jobId),
  head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? 'Job') }] }),
  pendingComponent: JobDetailSkeleton,
  component: JobPage,
});

function JobPage() {
  const job = Route.useLoaderData();
  const { profile } = Route.useRouteContext();
  const { href } = useLocation();

  if (!job) return <ClosedJob />;

  return <JobDetail job={job} signedIn={profile !== null} returnTo={href} />;
}
