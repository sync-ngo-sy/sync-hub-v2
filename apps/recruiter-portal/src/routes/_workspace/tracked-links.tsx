import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TenantTrackedLinksPage } from '@/features/tracked-links/components/tenant-tracked-links-page';
import type { LinkFilter } from '@/features/tracked-links/tracked-link';
import { pageTitle } from '@/lib/page-title';
import { trackedLinkSearchParams } from './-tracked-link-search-params';

export const Route = createFileRoute('/_workspace/tracked-links')({
  validateSearch: trackedLinkSearchParams,
  head: () => ({ meta: [{ title: pageTitle('Tracked links') }] }),
  component: TrackedLinksRoute,
});

/**
 * The search and the state live in the address, so a search is a link somebody can send and a
 * reload keeps what was being looked at. An empty term and the `all` state are left out rather
 * than written as empty values.
 *
 * Both callbacks are held steady, because the page debounces against them: a fresh function each
 * render would restart the settling timer on every keystroke's re-render.
 */
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
