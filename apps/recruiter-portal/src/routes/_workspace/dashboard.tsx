import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/dashboard')({
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return <PlaceholderPage title="Dashboard" />;
}
