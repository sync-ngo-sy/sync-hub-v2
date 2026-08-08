import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CandidateSearchPage } from '@/features/candidates/components/candidate-search-page';
import {
  type CandidateSearchFilters,
  type CandidateTab,
  DEFAULT_ORDER,
  type DirectoryOrder,
  searchAddress,
} from '@/features/candidates/search';
import { warmSearchTaxonomies } from '@/features/reference/reference-queries';
import { warmTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';
import {
  candidateOrderFrom,
  candidateSearchParams,
  candidateTabFrom,
  filtersFrom,
} from './-candidate-search-params';

export const Route = createFileRoute('/_workspace/candidates')({
  validateSearch: candidateSearchParams,
  loader: async ({ context }) => {
    await Promise.all([
      warmSearchTaxonomies(context.queryClient),
      warmTalentPool(context.queryClient),
    ]);
  },
  head: () => ({ meta: [{ title: pageTitle('Candidates') }] }),
  component: CandidatesRoute,
});

function CandidatesRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = candidateTabFrom(search);
  const order = candidateOrderFrom(search);

  const go = (next: {
    tab: CandidateTab;
    order: DirectoryOrder;
    filters: CandidateSearchFilters;
  }) =>
    void navigate({
      search: {
        tab: next.tab,
        sort: next.tab === 'search' || next.order === DEFAULT_ORDER ? undefined : next.order,
        ...searchAddress(next.filters),
      },
    });

  return (
    <CandidateSearchPage
      tab={tab}
      order={order}
      filters={filtersFrom(search)}
      onTabChange={(next) => go({ tab: next, order, filters: filtersFrom(search) })}
      onOrderChange={(next) => go({ tab, order: next, filters: filtersFrom(search) })}
      onFiltersChange={(filters) => go({ tab, order, filters })}
    />
  );
}
