import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/applications')({
  head: () => ({ meta: [{ title: pageTitle('My Applications') }] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  return (
    <PlaceholderPage
      title="My Applications"
      description="Everywhere you've applied, newest first."
    />
  );
}
