import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/templates')({
  head: () => ({ meta: [{ title: 'Templates · Sync Recruiter' }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return <PlaceholderPage title="Templates" />;
}
