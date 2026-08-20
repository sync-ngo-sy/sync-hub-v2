import { createFileRoute } from '@tanstack/react-router';
import { matchEvidence } from '@/features/candidates/candidate';
import { ensureCandidateRecord } from '@/features/candidates/candidate-record';
import {
  CandidateOutOfReach,
  CandidateViewPage,
} from '@/features/candidates/components/candidate-view-page';
import { readSearchHits } from '@/features/candidates/hooks/use-candidate-search';
import { recordProfile } from '@/features/profile/profile';
import { warmSearchTaxonomies } from '@/features/reference/reference-queries';
import { originFrom } from '@/features/shell/origin';
import { warmTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';
import { candidateRecordSearchParams } from './-candidate-search-params';

export const Route = createFileRoute('/_workspace/candidates_/$candidateId')({
  validateSearch: candidateRecordSearchParams,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const [record, hits] = await Promise.all([
      ensureCandidateRecord(context.queryClient, params.candidateId),
      readSearchHits(context.queryClient, deps),
      warmTalentPool(context.queryClient),
      warmSearchTaxonomies(context.queryClient),
    ]);

    if (!record) return null;

    const hit = hits.find((match) => match.candidate_id === params.candidateId);

    return { record, evidence: hit ? matchEvidence(hit) : null };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData ? recordProfile(loaderData.record).name : 'Candidate') }],
  }),
  component: CandidateRoute,
});

function CandidateRoute() {
  const found = Route.useLoaderData();
  const reading = Route.useSearch();

  if (!found) return <CandidateOutOfReach reading={reading} />;

  return (
    <CandidateViewPage
      record={found.record}
      evidence={found.evidence}
      reading={reading}
      origin={originFrom(reading.from)}
    />
  );
}
