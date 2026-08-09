import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { sortInAddress } from '@/features/applications/application';
import { ApplicationsPage as ApplicationsFeaturePage } from '@/features/applications/components/applications-page';
import type { TenantApplicationFilters } from '@/features/applications/hooks/use-tenant-applications';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';
import { applicationsSearchParams } from './-applications-search-params';

export const Route = createFileRoute('/_workspace/applications')({
  validateSearch: applicationsSearchParams,
  head: () => ({ meta: [{ title: pageTitle('Applications') }] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Applications">
      <ApplicationsFeaturePage
        filters={filters}
        onFiltersChange={(next: TenantApplicationFilters) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              pipeline: next.pipeline,
              screening: next.screening,
              received: next.received,
              sort: sortInAddress(next.sort),
            }),
          })
        }
        onApplicationOpen={(application) =>
          void navigate({
            to: '/applications/$applicationId',
            params: { applicationId: application.id },
          })
        }
      />
    </WidgetBoundary>
  );
}
