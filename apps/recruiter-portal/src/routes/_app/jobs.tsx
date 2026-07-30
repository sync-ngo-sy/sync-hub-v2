import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/jobs')({
  head: () => ({ meta: [{ title: 'Jobs · Sync Recruiter' }] }),
  component: JobsPage,
});

function JobsPage() {
  return <PlaceholderPage title="Jobs" />;
}
