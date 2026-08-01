import { createFileRoute, useLocation } from '@tanstack/react-router';
import { JobDetail } from '@/features/jobs/components/job-detail';
import { JobDetailSkeleton } from '@/features/jobs/components/job-detail-skeleton';
import { DeadTrackedLink } from '@/features/jobs/components/job-gone';
import { ensureJobByTrackedLink } from '@/features/jobs/job-queries';
import { pageTitle } from '@/lib/page-title';

/**
 * Where a Tracked link lands. It is the Job page in every way a visitor can see: resolving the
 * token is what counts the view, and nothing on screen says a campaign brought them here.
 */
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

  // `href` stays the link's own address, so signing in to apply keeps the Application attributed.
  return <JobDetail job={job} signedIn={profile !== null} returnTo={href} />;
}
