import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { PlacementsPage as PlacementsFeaturePage } from '@/features/placements/components/placements-page';
import { PlacementsSkeleton } from '@/features/placements/components/placements-skeleton';
import { claimTab, type HireClaim } from '@/features/placements/placement';
import { placementsAddress } from '@/features/placements/reading';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { originAddress } from '@/features/shell/origin';
import { pageTitle } from '@/lib/page-title';
import { placementsSearchParams } from './-placements-search-params';

export const Route = createFileRoute('/_workspace/placements')({
  validateSearch: placementsSearchParams,
  head: () => ({ meta: [{ title: pageTitle('Placements') }] }),
  pendingComponent: PlacementsSkeleton,
  component: PlacementsPage,
});

function PlacementsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const applicationLocation = (claim: HireClaim) => ({
    to: '/applications/$applicationId' as const,
    params: { applicationId: claim.application_id },
    search: { from: originAddress({ at: 'placements' }) },
  });

  return (
    <WidgetBoundary name="Placements">
      <PlacementsFeaturePage
        tab={claimTab(tab)}
        onTabChange={(chosen) => void navigate({ search: placementsAddress({ tab: chosen }) })}
        onClaimOpen={(claim) => void navigate(applicationLocation(claim))}
        claimHref={(claim) => router.buildLocation(applicationLocation(claim)).href}
      />
    </WidgetBoundary>
  );
}
