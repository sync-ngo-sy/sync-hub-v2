import { createFileRoute } from '@tanstack/react-router';
import {
  ApplicationNotFound,
  ApplicationReviewPage,
} from '@/features/applications/components/application-review-page';
import { ensureApplication } from '@/features/applications/hooks/use-application';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/applications_/$applicationId')({
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
  component: ApplicationRoute,
});

function ApplicationRoute() {
  const review = Route.useLoaderData();
  const { applicationId } = Route.useParams();

  if (!review) return <ApplicationNotFound />;

  return <ApplicationReviewPage applicationId={applicationId} />;
}
