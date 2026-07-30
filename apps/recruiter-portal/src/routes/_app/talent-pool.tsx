import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/talent-pool')({
  head: () => ({ meta: [{ title: 'Talent pool · Sync Recruiter' }] }),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  return <PlaceholderPage title="Talent pool" />;
}
