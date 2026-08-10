import { DataTable } from '@sync/ui/components/data-table';
import { Button } from '@sync/ui/components/ui/button';
import { Inbox } from 'lucide-react';
import { problemMessage } from '@/lib/api-problem';
import {
  type ApplicationSummary,
  hiddenBehind,
  PIPELINE_STATUSES,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
} from '../application';
import { useJobApplications } from '../hooks/use-job-applications';
import type { ApplicationFilters } from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ChecklistFilter } from './checklist-filter';

const COLUMNS = applicationColumns<ApplicationSummary>();

interface JobApplicationsProps {
  jobId: string;
  filters: ApplicationFilters;
  onFiltersChange: (filters: ApplicationFilters) => void;
  onApplicationOpen: (application: ApplicationSummary) => void;
  onShowLinks: () => void;
}

export function JobApplications({
  jobId,
  filters,
  onFiltersChange,
  onApplicationOpen,
  onShowLinks,
}: JobApplicationsProps) {
  const pipelineFilter = filters.pipeline?.length === 1 ? filters.pipeline : undefined;
  const pipeline = pipelineFilter ?? [...PIPELINE_STATUSES];
  const screening = screeningSelection(filters.screening);
  const applications = useJobApplications(jobId, { pipeline: pipelineFilter, screening });
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const active = [
    hiddenBehind(SCREENING_VERDICTS, screening, verdictCounts),
    hiddenBehind(PIPELINE_STATUSES, pipeline, statusCounts),
  ].filter((hidden) => hidden > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <ApplicationPipelineFilter
          pipeline={pipelineFilter}
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
        columns={COLUMNS}
        data={applications.data?.items ?? []}
        getRowId={(application) => application.id}
        rowLabel={(application) => `${application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        isLoading={applications.isPending}
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
          message:
            active === 0
              ? 'No one has applied yet — a tracked link is the quickest way to bring candidates to this Job.'
              : active === 1
                ? 'No Application on this Job matches that filter.'
                : 'No Application on this Job matches both filters.',
          action:
            active > 0 ? (
              <Button
                variant="outline"
                onClick={() =>
                  onFiltersChange({
                    pipeline: undefined,
                    screening: undefined,
                  })
                }
              >
                {active === 1 ? 'Clear filter' : 'Clear filters'}
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
