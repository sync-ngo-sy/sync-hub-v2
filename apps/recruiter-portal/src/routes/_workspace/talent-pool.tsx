import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { originAddress } from '@/features/shell/origin';
import { TalentPoolPage as TalentPoolFeaturePage } from '@/features/talent-pool/components/talent-pool-page';
import { warmSavedCandidates } from '@/features/talent-pool/hooks/use-talent-pool';
import { poolAddress } from '@/features/talent-pool/pool';
import { pageTitle } from '@/lib/page-title';
import { readingFrom, talentPoolSearchParams } from './-talent-pool-search-params';

export const Route = createFileRoute('/_workspace/talent-pool')({
  validateSearch: talentPoolSearchParams,
  loaderDeps: ({ search }) => readingFrom(search),
  loader: ({ context, deps }) => warmSavedCandidates(context.queryClient, deps),
  head: () => ({ meta: [{ title: pageTitle('Talent pool') }] }),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Talent pool">
      <TalentPoolFeaturePage
        reading={readingFrom(search)}
        onReadingChange={(reading) => void navigate({ search: poolAddress(reading) })}
        onCandidateOpen={(entry) =>
          void navigate({
            to: '/candidates/$candidateId',
            params: { candidateId: entry.candidate_id },
            search: { from: originAddress({ at: 'talent-pool' }) },
          })
        }
      />
    </WidgetBoundary>
  );
}
