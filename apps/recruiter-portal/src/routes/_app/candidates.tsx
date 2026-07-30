import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/candidates')({
  head: () => ({ meta: [{ title: 'Candidates · Sync Recruiter' }] }),
  component: CandidatesPage,
});

function CandidatesPage() {
  return <PlaceholderPage title="Candidates" />;
}
