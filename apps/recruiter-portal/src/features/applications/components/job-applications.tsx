import { DataTable } from '@sync/ui/components/data-table';
import { Button } from '@sync/ui/components/ui/button';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import {
  ALL_TAB,
  type ApplicationSort,
  type ApplicationSummary,
  anythingEnded,
  type PipelineStatus,
  type PipelineTab,
  pipelineStatuses,
  pipelineTab,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
  sortSelection,
  tabStages,
} from '../application';
import { sweepScope, sweptMessage } from '../ending';
import { useSweepJobApplications } from '../hooks/use-application-actions';
import { useJobApplications } from '../hooks/use-job-applications';
import { useTickedActs } from '../hooks/use-ticked-acts';
import {
  type ApplicationFilters,
  clearFiltersLabel,
  narrowedBy,
  noJobApplicationsMessage,
  readingNamed,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ApplicationsActsRail, LIST_BESIDE_RAIL } from './applications-acts-rail';
import { ChecklistFilter } from './checklist-filter';
import { TickedActDialog } from './ticked-act-dialog';

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
  const applications = useJobApplications(jobId, {
    statuses: pipelineStatuses(pipeline),
    verdicts: screening,
    sort,
  });
  const sweeping = useSweepJobApplications();
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const narrowing = narrowedBy(filters);
  const ended = anythingEnded(statusCounts);
  const everyVerdict = screening.length === SCREENING_VERDICTS.length;
  const items = applications.data?.items ?? [];
  const ticks = useTickedActs(items);
  const scope = sweepScope(tabStages(pipeline), statusCounts);
  const reading = readingNamed(pipeline, screening);

  function changeReading(next: ApplicationFilters) {
    ticks.clear();
    onFiltersChange(next);
  }

  async function sweep(to: PipelineStatus) {
    const swept = await sweeping.mutateAsync({
      params: { path: { job_id: jobId } },
      body: {
        statuses: scope.stages,
        to,
        qualification_statuses: everyVerdict ? null : screening,
      },
    });
    ticks.clear();
    toast.success(sweptMessage(swept, to));
    return swept;
  }

  function whereEmptyLeads() {
    if (narrowing > 0) {
      return (
        <Button
          variant="outline"
          onClick={() => onFiltersChange({ ...filters, pipeline: undefined, screening: undefined })}
        >
          {clearFiltersLabel(filters)}
        </Button>
      );
    }
    if (ended) {
      return (
        <Button
          variant="outline"
          onClick={() => onFiltersChange({ ...filters, pipeline: ALL_TAB })}
        >
          Go to all Applications
        </Button>
      );
    }
    return (
      <Button variant="outline" onClick={onShowLinks}>
        Go to tracked links
      </Button>
    );
  }

  return (
    <div className="space-y-(--space-section)">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <ApplicationPipelineFilter
          pipeline={pipeline}
          counts={statusCounts}
          onChange={(chosen: PipelineTab) => changeReading({ ...filters, pipeline: chosen })}
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
          onChange={(chosen) => changeReading({ ...filters, screening: chosen })}
        />
      </div>

      <div className={LIST_BESIDE_RAIL}>
        <div className="min-w-0">
          <DataTable
            label="Applications"
            columns={JOB_APPLICATION_COLUMNS}
            data={items}
            getRowId={(application) => application.id}
            rowLabel={(application) => `${application.candidate_name}'s Application`}
            onRowOpen={onApplicationOpen}
            rowHref={applicationHref}
            isLoading={applications.isPending}
            ticks={{ ticked: ticks.ids, onChange: ticks.onTick, can: ticks.can }}
            sort={{
              by: sort,
              onChange: (by) => changeReading({ ...filters, sort: by as ApplicationSort }),
            }}
            error={
              applications.isError
                ? {
                    message: problemMessage(
                      applications.error,
                      "Couldn't load these Applications.",
                    ),
                    onRetry: () => void applications.refetch(),
                  }
                : undefined
            }
            empty={{
              icon: Inbox,
              message: noJobApplicationsMessage(filters, ended),
              action: whereEmptyLeads(),
            }}
            loadMore={{
              hasMore: applications.hasNextPage,
              isLoading: applications.isFetchingNextPage,
              onLoadMore: () => void applications.fetchNextPage(),
            }}
          />
        </div>

        <ApplicationsActsRail scope={scope} reading={reading} onSweep={sweep} ticks={ticks} />
      </div>

      {ticks.confirming ? (
        <TickedActDialog
          act={ticks.confirming}
          ticked={ticks.ids}
          onConfirm={ticks.onConfirm}
          onClose={ticks.onClose}
        />
      ) : null}
    </div>
  );
}
