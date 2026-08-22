import { DataTable } from '@sync/ui/components/data-table';
import { Button } from '@sync/ui/components/ui/button';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import {
  ALL_TAB,
  type ApplicationSort,
  type ApplicationSummary,
  anythingEnded,
  type PipelineStatus,
  pipelineStatuses,
  pipelineTab,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
  sortSelection,
} from '../application';
import {
  actedMessage,
  actsOpenTo,
  nothingIsOpen,
  type TickedAct,
  tickable,
  whatItSwept,
  whereTickedRowsGo,
} from '../ending';
import {
  useMoveTickedApplications,
  useSweepJobApplications,
} from '../hooks/use-application-actions';
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
import { EndManyDialog } from './end-many-dialog';
import { TickedActDialog } from './ticked-act-dialog';
import { TickedActs } from './ticked-acts';

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
  const moving = useMoveTickedApplications();
  const [endingMany, setEndingMany] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<TickedAct | null>(null);
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const narrowing = narrowedBy(filters);
  const ended = anythingEnded(statusCounts);
  const everyVerdict = screening.length === SCREENING_VERDICTS.length;
  const items = applications.data?.items ?? [];
  const tickedRows = items.filter((application) => ticked.includes(application.id));
  const openActs = actsOpenTo(tickedRows.map((application) => application.status));

  function changeReading(next: ApplicationFilters) {
    setTicked([]);
    onFiltersChange(next);
  }

  async function moveTicked(act: TickedAct, chosen: string[]) {
    const done = await moving.mutateAsync({ ids: chosen, to: whereTickedRowsGo(act) });
    setConfirming(null);
    setTicked([]);
    toast.success(actedMessage(act, done, chosen.length));
    return done;
  }

  async function endMany(statuses: PipelineStatus[]) {
    const swept = await sweeping.mutateAsync({
      params: { path: { job_id: jobId } },
      body: { statuses, qualification_statuses: everyVerdict ? null : screening },
    });
    setEndingMany(false);
    setTicked([]);
    toast.success(actedMessage('end', whatItSwept(swept)));
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <ApplicationPipelineFilter
          pipeline={pipeline}
          counts={statusCounts}
          onChange={(chosen) => changeReading({ ...filters, pipeline: chosen })}
        />

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
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
          <Button
            variant="outline"
            disabled={nothingIsOpen(statusCounts)}
            onClick={() => setEndingMany(true)}
          >
            End many
          </Button>
        </div>
      </div>

      {tickedRows.length > 0 ? (
        <TickedActs
          ticked={tickedRows.length}
          acts={openActs}
          onAct={setConfirming}
          onClear={() => setTicked([])}
        />
      ) : null}

      <DataTable
        label="Applications"
        columns={JOB_APPLICATION_COLUMNS}
        data={items}
        getRowId={(application) => application.id}
        rowLabel={(application) => `${application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        rowHref={applicationHref}
        isLoading={applications.isPending}
        ticks={{
          ticked: tickedRows.map((application) => application.id),
          onChange: setTicked,
          can: (application) => tickable(application.status, openActs),
        }}
        sort={{
          by: sort,
          onChange: (by) => changeReading({ ...filters, sort: by as ApplicationSort }),
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
          message: noJobApplicationsMessage(filters, ended),
          action: whereEmptyLeads(),
        }}
        loadMore={{
          hasMore: applications.hasNextPage,
          isLoading: applications.isFetchingNextPage,
          onLoadMore: () => void applications.fetchNextPage(),
        }}
      />

      {endingMany ? (
        <EndManyDialog
          counts={statusCounts}
          narrowed={!everyVerdict}
          onConfirm={endMany}
          onClose={() => setEndingMany(false)}
        />
      ) : null}

      {confirming ? (
        <TickedActDialog
          act={confirming}
          ticked={tickedRows.map((application) => application.id)}
          onConfirm={(chosen) => moveTicked(confirming, chosen)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}
