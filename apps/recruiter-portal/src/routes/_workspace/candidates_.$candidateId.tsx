import { createFileRoute } from '@tanstack/react-router';
import { matchEvidence } from '@/features/candidates/candidate';
import { ensureCandidateRecord } from '@/features/candidates/candidate-record';
import {
  CandidateOutOfReach,
  CandidateViewPage,
} from '@/features/candidates/components/candidate-view-page';
import { cachedSearchHits } from '@/features/candidates/hooks/use-candidate-search';
import { recordProfile } from '@/features/profile/profile';
import { warmSearchTaxonomies } from '@/features/reference/reference-queries';
import { warmTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';
import { candidateSearchParams, filtersFrom } from './-candidate-search-params';

export const Route = createFileRoute('/_workspace/candidates_/$candidateId')({
  validateSearch: candidateSearchParams,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const [record] = await Promise.all([
      ensureCandidateRecord(context.queryClient, params.candidateId),
      warmTalentPool(context.queryClient),
      warmSearchTaxonomies(context.queryClient),
    ]);

    if (!record) return null;

    const hit = cachedSearchHits(context.queryClient, filtersFrom(deps)).find(
      (match) => match.candidate_id === params.candidateId,
    );

    return { record, evidence: hit ? matchEvidence(hit) : null };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData ? recordProfile(loaderData.record).name : 'Candidate') }],
  }),
  component: CandidateRoute,
});

function CandidateRoute() {
  const found = Route.useLoaderData();
  const filters = filtersFrom(Route.useSearch());

  if (!found) return <CandidateOutOfReach filters={filters} />;

  return <CandidateViewPage record={found.record} evidence={found.evidence} filters={filters} />;
}
