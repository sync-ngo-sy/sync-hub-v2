import { createFileRoute } from '@tanstack/react-router';
import {
  ApplicationNotFound,
  ApplicationReviewPage,
} from '@/features/applications/components/application-review-page';
import { ApplicationReviewSkeleton } from '@/features/applications/components/application-review-skeleton';
import { ensureApplication } from '@/features/applications/hooks/use-application';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { originFrom } from '@/features/shell/origin';
import { pageTitle } from '@/lib/page-title';
import { applicationReviewSearchParams } from './-applications-search-params';

export const Route = createFileRoute('/_workspace/applications_/$applicationId')({
  validateSearch: applicationReviewSearchParams,
  loader: async ({ context, params }) => {
    const [review] = await Promise.all([
      ensureApplication(context.queryClient, params.applicationId),
      warmReferenceData(context.queryClient),
    ]);
    return review;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.snapshot.full_name ?? 'Application') }],
  }),
  pendingComponent: ApplicationReviewSkeleton,
  component: ApplicationRoute,
});

function ApplicationRoute() {
  const review = Route.useLoaderData();
  const { applicationId } = Route.useParams();
  const { from, ...reading } = Route.useSearch();

  if (!review) return <ApplicationNotFound />;

  return (
    <ApplicationReviewPage
      applicationId={applicationId}
      origin={originFrom(from)}
      reading={reading}
    />
  );
}
