import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';

export const Route = createFileRoute('/_shell/jobs/$jobId')({
  component: JobDetailPage,
});

function JobDetailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Job detail" description="The full role, and how to apply." />
      <EmptyState
        icon={<Briefcase />}
        title="Job detail is coming"
        description="Reading a Job and applying ships in its own ticket."
      />
    </div>
  );
}
