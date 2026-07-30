import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/dashboard')({
  head: () => ({ meta: [{ title: 'Dashboard · Sync Recruiter' }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return <PlaceholderPage title="Dashboard" />;
}
