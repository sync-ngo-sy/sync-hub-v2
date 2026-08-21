import { DataTable } from '@sync/ui/components/data-table';
import { Button } from '@sync/ui/components/ui/button';
import { Inbox } from 'lucide-react';
import { problemMessage } from '@/lib/api-problem';
import {
  type ApplicationSort,
  type ApplicationSummary,
  pipelineTab,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
  sortSelection,
} from '../application';
import { useJobApplications } from '../hooks/use-job-applications';
import {
  type ApplicationFilters,
  clearFiltersLabel,
  narrowedBy,
  noJobApplicationsMessage,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ChecklistFilter } from './checklist-filter';

export const JOB_APPLICATION_COLUMNS = applicationColumns<ApplicationSummary>();

interface JobApplicationsProps {
  jobId: string;
  filters: ApplicationFilters;
  onFiltersChange: (filters: ApplicationFilters) => void;
  onApplicationOpen: (application: ApplicationSummary) => void;
  applicationHref: (application: ApplicationSummary) => string;
  onShowLinks: () => void;
}

export function JobApplications({
  jobId,
  filters,
  onFiltersChange,
  onApplicationOpen,
  applicationHref,
  onShowLinks,
}: JobApplicationsProps) {
  const pipeline = pipelineTab(filters.pipeline);
  const screening = screeningSelection(filters.screening);
  const sort = sortSelection(filters.sort);
  const applications = useJobApplications(jobId, { pipeline, screening, sort });
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const narrowing = narrowedBy(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <ApplicationPipelineFilter
          pipeline={pipeline}
          counts={statusCounts}
          onChange={(chosen) => onFiltersChange({ ...filters, pipeline: chosen })}
        />

        <ChecklistFilter
          label="Screening"
          noun="verdicts"
          options={SCREENING_VERDICTS.map((verdict) => ({
            value: verdict,
            label: screeningState(verdict).label,
          }))}
          selected={screening}
          counts={verdictCounts}
          onChange={(chosen) => onFiltersChange({ ...filters, screening: chosen })}
        />
      </div>

      <DataTable
        label="Applications"
        columns={JOB_APPLICATION_COLUMNS}
        data={applications.data?.items ?? []}
        getRowId={(application) => application.id}
        rowLabel={(application) => `${application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        rowHref={applicationHref}
        isLoading={applications.isPending}
        sort={{
          by: sort,
          onChange: (by) => onFiltersChange({ ...filters, sort: by as ApplicationSort }),
        }}
        error={
          applications.isError
            ? {
                message: problemMessage(applications.error, "Couldn't load these Applications."),
                onRetry: () => void applications.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Inbox,
          message: noJobApplicationsMessage(filters),
          action:
            narrowing > 0 ? (
              <Button
                variant="outline"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    pipeline: undefined,
                    screening: undefined,
                  })
                }
              >
                {clearFiltersLabel(filters)}
              </Button>
            ) : (
              <Button variant="outline" onClick={onShowLinks}>
                Go to tracked links
              </Button>
            ),
        }}
        loadMore={{
          hasMore: applications.hasNextPage,
          isLoading: applications.isFetchingNextPage,
          onLoadMore: () => void applications.fetchNextPage(),
        }}
      />
    </div>
  );
}
