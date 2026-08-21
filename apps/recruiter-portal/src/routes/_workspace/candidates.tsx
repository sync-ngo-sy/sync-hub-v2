import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CandidateSearchPage } from '@/features/candidates/components/candidate-search-page';
import { CandidateSearchSkeleton } from '@/features/candidates/components/candidate-search-skeleton';
import { candidatesAddress } from '@/features/candidates/reading';
import { warmSearchTaxonomies } from '@/features/reference/reference-queries';
import { warmTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';
import { candidateSearchParams } from './-candidate-search-params';

export const Route = createFileRoute('/_workspace/candidates')({
  validateSearch: candidateSearchParams,
  loader: async ({ context }) => {
    await Promise.all([
      warmSearchTaxonomies(context.queryClient),
      warmTalentPool(context.queryClient),
    ]);
  },
  head: () => ({ meta: [{ title: pageTitle('Candidates') }] }),
  pendingComponent: CandidateSearchSkeleton,
  component: CandidatesRoute,
});

function CandidatesRoute() {
  const reading = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <CandidateSearchPage
      reading={reading}
      onReadingChange={(next) => void navigate({ search: candidatesAddress(next) })}
    />
  );
}
