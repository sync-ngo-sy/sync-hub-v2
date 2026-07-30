import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_app/talent-pool')({
  head: () => ({ meta: [{ title: pageTitle('Talent pool') }] }),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  return <PlaceholderPage title="Talent pool" />;
}
