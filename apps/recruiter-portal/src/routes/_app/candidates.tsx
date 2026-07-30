import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_app/candidates')({
  head: () => ({ meta: [{ title: pageTitle('Candidates') }] }),
  component: CandidatesPage,
});

function CandidatesPage() {
  return <PlaceholderPage title="Candidates" />;
}
