import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';

export const Route = createFileRoute('/_authed/applications')({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { profile } = Route.useRouteContext();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="My Applications" description={`Signed in as ${profile.full_name}`} />
      <EmptyState
        icon={<Inbox />}
        title="No applications yet"
        description="Browsing and applying to Jobs ships in its own ticket."
      />
    </div>
  );
}
