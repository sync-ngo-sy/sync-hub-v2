import { DataTable } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { ChoicePicker } from '@/features/jobs/components/choice-select';
import { jobColumn } from '@/features/jobs/components/job-column';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import {
  type ApplicationSort,
  anythingEnded,
  holdsOneStatus,
  PIPELINE_STATUSES,
  type PipelineStatus,
  pipelineSelection,
  pipelineStatuses,
  RECEIVED_RANGES,
  type ReceivedRange,
  receivedSelection,
  receivedWithin,
  SCREENING_VERDICTS,
  screeningSelection,
  sortSelection,
  type TenantApplication,
} from '../application';
import { receivedInSweep, sweepScope, sweptMessage } from '../ending';
import { useSweepTenantApplications } from '../hooks/use-application-actions';
import { useTenantApplications } from '../hooks/use-tenant-applications';
import { useTickedActs } from '../hooks/use-ticked-acts';
import {
  clearFiltersLabel,
  narrowedBy,
  noApplicationsMessage,
  screeningNarrowing,
  type TenantApplicationFilters,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationsFilterRail } from './applications-filter-rail';
import { SweepActs } from './sweep-acts';
import { TickedActDialog } from './ticked-act-dialog';
import { TickedActs } from './ticked-acts';

export const TENANT_APPLICATION_COLUMNS = applicationColumns<TenantApplication>(jobColumn());

const LIST_BESIDE_RAIL =
  'flex flex-col-reverse gap-(--space-section) lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]';

const TO_THE_PLACEMENTS = (
  <p className="text-meta text-muted-foreground">
    Hired counts every hire your team has claimed. The ones the Candidate confirmed are your{' '}
    <Link
      to="/placements"
      search={{}}
      className="rounded-sm font-medium text-accent-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Placements
    </Link>
    .
  </p>
);

const TO_THE_JOBS = (
  <Link to="/jobs" search={{}} className={buttonVariants({ variant: 'outline' })}>
    Go to your jobs
  </Link>
);

interface ApplicationsPageProps {
  filters: TenantApplicationFilters;
  onFiltersChange: (filters: TenantApplicationFilters) => void;
  onApplicationOpen: (application: TenantApplication) => void;
  applicationHref: (application: TenantApplication) => string;
}

export function ApplicationsPage({
  filters,
  onFiltersChange,
  onApplicationOpen,
  applicationHref,
}: ApplicationsPageProps) {
  const pipeline = pipelineSelection(filters.pipeline);
  const screening = screeningSelection(filters.screening);
  const range = receivedSelection(filters.received);
  const sort = sortSelection(filters.sort);
  const applications = useTenantApplications({
    statuses: pipelineStatuses(pipeline),
    verdicts: screening,
    received: filters.received,
    sort,
  });
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const narrowing = narrowedBy(filters);
  const ended = anythingEnded(statusCounts);
  const items = applications.data?.items ?? [];
  const ticks = useTickedActs(items);
  const sweeping = useSweepTenantApplications();
  const everyVerdict = screening.length === SCREENING_VERDICTS.length;
  const scope = sweepScope(pipeline, statusCounts);
  const showsHired = holdsOneStatus(pipeline) && pipeline[0] === 'hired';

  async function sweep(to: PipelineStatus) {
    const swept = await sweeping.mutateAsync({
      body: {
        statuses: scope.stages,
        to,
        qualification_statuses: everyVerdict ? null : screening,
        received_within: receivedInSweep(filters.received),
      },
    });
    ticks.clear();
    toast.success(sweptMessage(swept, to));
    return swept;
  }

  function changeReading(next: TenantApplicationFilters) {
    ticks.clear();
    onFiltersChange(next);
  }

  function whereEmptyLeads() {
    if (narrowing > 0) {
      return (
        <Button
          variant="outline"
          onClick={() =>
            onFiltersChange({
              ...filters,
              pipeline: undefined,
              screening: undefined,
              received: undefined,
            })
          }
        >
          {clearFiltersLabel(filters)}
        </Button>
      );
    }
    if (ended) {
      return (
        <Button
          variant="outline"
          onClick={() => onFiltersChange({ ...filters, pipeline: [...PIPELINE_STATUSES] })}
        >
          Go to all Applications
        </Button>
      );
    }
    return TO_THE_JOBS;
  }

  return (
    <>
      <WorkspaceHeader>
        <PageHeader
          title="Applications"
          description="Everyone who has applied, across every Job your Tenant is hiring for."
        />
      </WorkspaceHeader>

      <div className={cn(LIST_BESIDE_RAIL, 'pt-(--space-section)')}>
        <div className="min-w-0 space-y-4">
          {showsHired ? TO_THE_PLACEMENTS : null}

          {ticks.count > 0 ? (
            <TickedActs
              ticked={ticks.count}
              acts={ticks.acts}
              onAct={ticks.onAct}
              onClear={ticks.clear}
            />
          ) : null}

          <DataTable
            label="Applications"
            columns={TENANT_APPLICATION_COLUMNS}
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
                    message: problemMessage(applications.error, "Couldn't load your Applications."),
                    onRetry: () => void applications.refetch(),
                  }
                : undefined
            }
            empty={{
              icon: Inbox,
              message: noApplicationsMessage(filters, ended),
              action: whereEmptyLeads(),
            }}
            loadMore={{
              hasMore: applications.hasNextPage,
              isLoading: applications.isFetchingNextPage,
              onLoadMore: () => void applications.fetchNextPage(),
            }}
          />
        </div>

        <ApplicationsFilterRail
          pipeline={pipeline}
          onPipelineChange={(chosen) => changeReading({ ...filters, pipeline: chosen })}
          screening={screening}
          onScreeningChange={(chosen) => changeReading({ ...filters, screening: chosen })}
          counts={statusCounts}
          verdictCounts={verdictCounts}
          extra={
            <div className="space-y-2">
              <p className="font-semibold text-meta uppercase tracking-wide text-muted-foreground">
                Received
              </p>
              <ChoicePicker
                label="Received"
                items={RECEIVED_RANGES}
                value={range}
                onValueChange={(chosen: ReceivedRange) =>
                  changeReading({ ...filters, received: receivedWithin(chosen) })
                }
                className="w-full"
              />
            </div>
          }
          acts={
            <SweepActs scope={scope} narrowing={screeningNarrowing(screening)} onSweep={sweep} />
          }
        />
      </div>

      {ticks.confirming ? (
        <TickedActDialog
          act={ticks.confirming}
          ticked={ticks.ids}
          onConfirm={ticks.onConfirm}
          onClose={ticks.onClose}
        />
      ) : null}
    </>
  );
}
