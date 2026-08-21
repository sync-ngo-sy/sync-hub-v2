import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TenantTrackedLinksPage } from '@/features/tracked-links/components/tenant-tracked-links-page';
import { TrackedLinksSkeleton } from '@/features/tracked-links/components/tracked-links-skeleton';
import type { LinkFilter } from '@/features/tracked-links/tracked-link';
import { pageTitle } from '@/lib/page-title';
import { trackedLinkSearchParams } from './-tracked-link-search-params';

export const Route = createFileRoute('/_workspace/tracked-links')({
  validateSearch: trackedLinkSearchParams,
  head: () => ({ meta: [{ title: pageTitle('Tracked links') }] }),
  pendingComponent: TrackedLinksSkeleton,
  component: TrackedLinksRoute,
});

function TrackedLinksRoute() {
  const { q, state } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const onSearch = useCallback(
    (asked: string) =>
      void navigate({ search: (was) => ({ ...was, q: asked === '' ? undefined : asked }) }),
    [navigate],
  );

  const onFilterChange = useCallback(
    (filter: LinkFilter) =>
      void navigate({
        search: (was) => ({ ...was, state: filter === 'all' ? undefined : filter }),
      }),
    [navigate],
  );

  return (
    <WidgetBoundary name="Tracked links">
      <TenantTrackedLinksPage
        q={q ?? ''}
        filter={state ?? 'all'}
        onSearch={onSearch}
        onFilterChange={onFilterChange}
      />
    </WidgetBoundary>
  );
}
