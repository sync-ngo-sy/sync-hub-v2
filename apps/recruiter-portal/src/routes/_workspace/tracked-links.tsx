import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TenantTrackedLinksPage } from '@/features/tracked-links/components/tenant-tracked-links-page';
import { trackedLinksFirstPageQuery } from '@/features/tracked-links/hooks/use-tenant-tracked-links';
import type { LinkFilter } from '@/features/tracked-links/tracked-link';
import { pageTitle } from '@/lib/page-title';
import { trackedLinkSearchParams } from './-tracked-link-search-params';

export const Route = createFileRoute('/_workspace/tracked-links')({
  validateSearch: trackedLinkSearchParams,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trackedLinksFirstPageQuery()).catch(() => undefined),
  head: () => ({ meta: [{ title: pageTitle('Tracked links') }] }),
  component: TrackedLinksRoute,
});

/** The search lives in the address, so a search is a link somebody can send and a reload keeps
 * what was being looked at. An empty term and the `all` state are left out rather than written
 * as empty values. */
function TrackedLinksRoute() {
  const { q, state } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <TenantTrackedLinksPage
      q={q ?? ''}
      filter={state ?? 'all'}
      onSearch={(asked) =>
        void navigate({ search: (was) => ({ ...was, q: asked === '' ? undefined : asked }) })
      }
      onFilterChange={(filter: LinkFilter) =>
        void navigate({
          search: (was) => ({ ...was, state: filter === 'all' ? undefined : filter }),
        })
      }
    />
  );
}
