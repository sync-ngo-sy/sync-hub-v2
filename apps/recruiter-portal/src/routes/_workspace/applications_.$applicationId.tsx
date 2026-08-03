import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/applications_/$applicationId')({
  head: () => ({ meta: [{ title: pageTitle('Application') }] }),
  component: ApplicationRoute,
});

function ApplicationRoute() {
  return <PlaceholderPage title="Application review" />;
}
