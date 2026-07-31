import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/templates')({
  head: () => ({ meta: [{ title: pageTitle('Templates') }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return <PlaceholderPage title="Templates" />;
}
