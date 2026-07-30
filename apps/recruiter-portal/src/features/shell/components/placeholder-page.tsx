import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { Hammer } from 'lucide-react';

/**
 * A destination the shell already routes to, whose feature ticket has not landed yet. Each
 * of those tickets replaces this body with the real page.
 */
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
