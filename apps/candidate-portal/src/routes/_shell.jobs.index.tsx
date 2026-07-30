import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';

export const Route = createFileRoute('/_shell/jobs/')({
  component: BrowseJobsPage,
});

function BrowseJobsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Browse jobs" description="Every open role across Syria." />
      <EmptyState
        icon={<Briefcase />}
        title="Browsing jobs is coming"
        description="The full job browser ships in its own ticket."
      />
    </div>
  );
}
