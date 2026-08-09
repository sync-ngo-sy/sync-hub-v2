import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
            search: (prev) => ({ ...prev, pipeline: next.pipeline, received: next.received }),
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
