import { createFileRoute } from '@tanstack/react-router';
import { matchEvidence, matchedCard, pooledCard } from '@/features/candidates/candidate';
import {
  CandidateOutOfReach,
  CandidateViewPage,
} from '@/features/candidates/components/candidate-view-page';
import { readSearchHits } from '@/features/candidates/hooks/use-candidate-search';
import { warmSearchTaxonomies } from '@/features/reference/reference-queries';
import { warmTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';
import { candidateSearchParams, filtersFrom } from './-candidate-search-params';

export const Route = createFileRoute('/_workspace/candidates_/$candidateId')({
  validateSearch: candidateSearchParams,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const filters = filtersFrom(deps);
    const [hits, pool] = await Promise.all([
      readSearchHits(context.queryClient, filters),
      warmTalentPool(context.queryClient),
      warmSearchTaxonomies(context.queryClient),
    ]);

    const match = hits.find((hit) => hit.candidate_id === params.candidateId);
    if (match) return { card: matchedCard(match), evidence: matchEvidence(match) };

    const saved = pool.find((entry) => entry.candidate_id === params.candidateId);
    return saved ? { card: pooledCard(saved), evidence: null } : null;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.card.fullName ?? 'Candidate') }],
  }),
  component: CandidateRoute,
});

function CandidateRoute() {
  const found = Route.useLoaderData();
  const filters = filtersFrom(Route.useSearch());

  if (!found) return <CandidateOutOfReach filters={filters} />;

  return <CandidateViewPage card={found.card} evidence={found.evidence} filters={filters} />;
}
