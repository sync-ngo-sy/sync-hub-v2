import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/applications')({
  head: () => ({ meta: [{ title: 'Applications · Sync Recruiter' }] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  return <PlaceholderPage title="Applications" />;
}
