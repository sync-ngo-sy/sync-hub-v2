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
  ALL_TAB,
  type ApplicationSort,
  anythingEnded,
  type PipelineStatus,
  type PipelineTab,
  pipelineStatuses,
  pipelineTab,
  RECEIVED_RANGES,
  type ReceivedRange,
  receivedSelection,
  receivedWithin,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
  sortSelection,
  type TenantApplication,
  tabStages,
} from '../application';
import { receivedInSweep, sweepScope, sweptMessage } from '../ending';
import { useSweepTenantApplications } from '../hooks/use-application-actions';
import { useTenantApplications } from '../hooks/use-tenant-applications';
import { useTickedActs } from '../hooks/use-ticked-acts';
import {
  clearFiltersLabel,
  narrowedBy,
  noApplicationsMessage,
  readingNamed,
  type TenantApplicationFilters,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ApplicationsActsRail } from './applications-acts-rail';
import { ChecklistFilter } from './checklist-filter';
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
  const pipeline = pipelineTab(filters.pipeline);
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
  const scope = sweepScope(tabStages(pipeline), statusCounts);
  const reading = readingNamed(pipeline, screening, filters.received);

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
          onClick={() => onFiltersChange({ ...filters, pipeline: ALL_TAB })}
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

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-(--space-section)">
        <div className="flex min-w-0 flex-col gap-3">
          <ApplicationPipelineFilter
            pipeline={pipeline}
            counts={statusCounts}
            onChange={(chosen: PipelineTab) => changeReading({ ...filters, pipeline: chosen })}
          />
          {pipeline === 'hired' ? TO_THE_PLACEMENTS : null}
        </div>

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
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
              Received
            </span>
            <ChoicePicker
              label="Received"
              items={RECEIVED_RANGES}
              value={range}
              onValueChange={(chosen: ReceivedRange) =>
                changeReading({ ...filters, received: receivedWithin(chosen) })
              }
            />
          </div>
        </div>
      </div>

      <div className={cn(LIST_BESIDE_RAIL, 'pt-(--space-section)')}>
        <div className="min-w-0">
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

        <ApplicationsActsRail
          sweep={<SweepActs scope={scope} reading={reading} onSweep={sweep} />}
          ticked={
            ticks.count > 0 ? (
              <TickedActs
                ticked={ticks.count}
                acts={ticks.acts}
                onAct={ticks.onAct}
                onClear={ticks.clear}
              />
            ) : null
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
