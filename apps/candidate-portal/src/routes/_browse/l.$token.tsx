import { createFileRoute, useLocation } from '@tanstack/react-router';
import { JobDetail } from '@/features/jobs/components/job-detail';
import { JobDetailSkeleton } from '@/features/jobs/components/job-detail-skeleton';
import { DeadTrackedLink } from '@/features/jobs/components/job-gone';
import { ensureJobByTrackedLink } from '@/features/jobs/job-queries';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_browse/l/$token')({
  loader: ({ context, params }) => ensureJobByTrackedLink(context.queryClient, params.token),
  head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? 'Job') }] }),
  pendingComponent: JobDetailSkeleton,
  component: TrackedLinkLanding,
});

function TrackedLinkLanding() {
  const job = Route.useLoaderData();
  const { profile } = Route.useRouteContext();
  const { href } = useLocation();

  if (!job) return <DeadTrackedLink />;

  return <JobDetail job={job} signedIn={profile !== null} returnTo={href} />;
}
