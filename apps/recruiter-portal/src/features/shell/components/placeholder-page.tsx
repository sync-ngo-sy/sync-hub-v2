import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { Hammer } from 'lucide-react';

/** A destination the shell routes to already; its own ticket replaces this body. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} />
      <EmptyState
        icon={<Hammer />}
        title="Not built yet"
        description="This part of the workspace is still being built."
      />
    </div>
  );
}
