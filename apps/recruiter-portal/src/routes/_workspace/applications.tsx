import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ApplicationsPage as ApplicationsFeaturePage } from '@/features/applications/components/applications-page';
import { applicationsAddress } from '@/features/applications/reading';
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
        onFiltersChange={(next) => void navigate({ search: applicationsAddress(next) })}
        onApplicationOpen={(application) =>
          void navigate({
            to: '/applications/$applicationId',
            params: { applicationId: application.id },
            search: applicationsAddress(filters),
          })
        }
      />
    </WidgetBoundary>
  );
}
