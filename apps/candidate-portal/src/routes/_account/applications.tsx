import { createFileRoute } from '@tanstack/react-router';
import { ApplicationsPage } from '@/features/applications/components/applications-page';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/applications')({
  head: () => ({ meta: [{ title: pageTitle('My Applications') }] }),
  component: ApplicationsRoute,
});

function ApplicationsRoute() {
  return (
    <WidgetBoundary name="Applications">
      <ApplicationsPage />
    </WidgetBoundary>
  );
}
