import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_browse/jobs_/$jobId')({
  head: () => ({ meta: [{ title: pageTitle('Job') }] }),
  component: JobPage,
});

/** Provisional: #54 builds Job detail. The landing's jobs index links here. */
function JobPage() {
  return <PlaceholderPage title="Job" description="Everything applying asks for." />;
}
