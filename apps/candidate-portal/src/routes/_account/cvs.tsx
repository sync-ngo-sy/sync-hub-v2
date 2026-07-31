import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/cvs')({
  head: () => ({ meta: [{ title: pageTitle('CVs') }] }),
  component: CvsPage,
});

function CvsPage() {
  return <PlaceholderPage title="CVs" description="Up to five, one of them current." />;
}
