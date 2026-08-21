import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { originAddress } from '@/features/shell/origin';
import { TalentPoolPage as TalentPoolFeaturePage } from '@/features/talent-pool/components/talent-pool-page';
import { TalentPoolSkeleton } from '@/features/talent-pool/components/talent-pool-skeleton';
import { warmSavedCandidates } from '@/features/talent-pool/hooks/use-talent-pool';
import { type PooledCandidate, poolAddress } from '@/features/talent-pool/pool';
import { pageTitle } from '@/lib/page-title';
import { readingFrom, talentPoolSearchParams } from './-talent-pool-search-params';

export const Route = createFileRoute('/_workspace/talent-pool')({
  validateSearch: talentPoolSearchParams,
  loaderDeps: ({ search }) => readingFrom(search),
  loader: ({ context, deps }) => warmSavedCandidates(context.queryClient, deps),
  head: () => ({ meta: [{ title: pageTitle('Talent pool') }] }),
  pendingComponent: TalentPoolSkeleton,
  component: TalentPoolPage,
});

function TalentPoolPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const candidateLocation = (entry: PooledCandidate) => ({
    to: '/candidates/$candidateId' as const,
    params: { candidateId: entry.candidate_id },
    search: { from: originAddress({ at: 'talent-pool' }) },
  });

  return (
    <WidgetBoundary name="Talent pool">
      <TalentPoolFeaturePage
        reading={readingFrom(search)}
        onReadingChange={(reading) => void navigate({ search: poolAddress(reading) })}
        onCandidateOpen={(entry) => void navigate(candidateLocation(entry))}
        candidateHref={(entry) => router.buildLocation(candidateLocation(entry)).href}
      />
    </WidgetBoundary>
  );
}
