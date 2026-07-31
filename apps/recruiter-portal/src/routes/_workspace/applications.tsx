import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/applications')({
  head: () => ({ meta: [{ title: pageTitle('Applications') }] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  return <PlaceholderPage title="Applications" />;
}
