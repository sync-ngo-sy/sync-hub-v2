import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TalentPoolPage as TalentPoolFeaturePage } from '@/features/talent-pool/components/talent-pool-page';
import { warmSavedCandidates } from '@/features/talent-pool/hooks/use-talent-pool';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/talent-pool')({
  loader: ({ context }) => warmSavedCandidates(context.queryClient),
  head: () => ({ meta: [{ title: pageTitle('Talent pool') }] }),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Talent pool">
      <TalentPoolFeaturePage
        onCandidateOpen={(entry) =>
          void navigate({
            to: '/candidates/$candidateId',
            params: { candidateId: entry.candidate_id },
            search: {},
          })
        }
      />
    </WidgetBoundary>
  );
}
