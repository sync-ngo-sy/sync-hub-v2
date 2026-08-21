import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import type { TenantApplication } from '@/features/applications/application';
import { ApplicationsPage as ApplicationsFeaturePage } from '@/features/applications/components/applications-page';
import { ApplicationsSkeleton } from '@/features/applications/components/applications-skeleton';
import { applicationsAddress } from '@/features/applications/reading';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';
import { applicationsSearchParams } from './-applications-search-params';

export const Route = createFileRoute('/_workspace/applications')({
  validateSearch: applicationsSearchParams,
  head: () => ({ meta: [{ title: pageTitle('Applications') }] }),
  pendingComponent: ApplicationsSkeleton,
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const applicationLocation = (application: TenantApplication) => ({
    to: '/applications/$applicationId' as const,
    params: { applicationId: application.id },
    search: applicationsAddress(filters),
  });

  return (
    <WidgetBoundary name="Applications">
      <ApplicationsFeaturePage
        filters={filters}
        onFiltersChange={(next) => void navigate({ search: applicationsAddress(next) })}
        onApplicationOpen={(application) => void navigate(applicationLocation(application))}
        applicationHref={(application) =>
          router.buildLocation(applicationLocation(application)).href
        }
      />
    </WidgetBoundary>
  );
}
