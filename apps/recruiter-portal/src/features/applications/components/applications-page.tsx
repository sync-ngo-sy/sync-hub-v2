import { DataTable } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChoicePicker } from '@/features/jobs/components/choice-select';
import { jobColumn } from '@/features/jobs/components/job-column';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import {
  ALL_TAB,
  type ApplicationSort,
  anythingEnded,
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
} from '../application';
import { endedMessage, endLabel, stillOpen, tickedLabel } from '../ending';
import { useEndApplications } from '../hooks/use-application-actions';
import { useTenantApplications } from '../hooks/use-tenant-applications';
import {
  clearFiltersLabel,
  narrowedBy,
  noApplicationsMessage,
  type TenantApplicationFilters,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ChecklistFilter } from './checklist-filter';
import { EndTickedDialog } from './end-ticked-dialog';

export const TENANT_APPLICATION_COLUMNS = applicationColumns<TenantApplication>(jobColumn());

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
  const ending = useEndApplications();
  const [ticked, setTicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  // A tick is a statement about a row on screen, so a list that is no longer the same list has
  // no ticks: whatever was ticked leaves with the Reading it was ticked under.
  function changeFilters(next: TenantApplicationFilters) {
    setTicked([]);
    onFiltersChange(next);
  }

  async function endTicked(chosen: string[]) {
    const swept = await ending.mutateAsync(chosen);
    setConfirming(false);
    setTicked([]);
    toast.success(endedMessage(swept, chosen.length));
    return swept;
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

      <div className="space-y-(--space-section) pt-(--space-section)">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-col gap-3">
            <ApplicationPipelineFilter
              pipeline={pipeline}
              counts={statusCounts}
              onChange={(chosen) => changeFilters({ ...filters, pipeline: chosen })}
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
              onChange={(chosen) => changeFilters({ ...filters, screening: chosen })}
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
                  changeFilters({ ...filters, received: receivedWithin(chosen) })
                }
              />
            </div>
          </div>
        </div>

        {ticked.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-(--space-card) py-3 shadow-card">
            <p role="status" className="text-dense text-foreground">
              {tickedLabel(ticked.length)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setTicked([])}>
                Clear ticks
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                {endLabel(ticked.length)}
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          label="Applications"
          columns={TENANT_APPLICATION_COLUMNS}
          data={applications.data?.items ?? []}
          getRowId={(application) => application.id}
          rowLabel={(application) => `${application.candidate_name}'s Application`}
          onRowOpen={onApplicationOpen}
          rowHref={applicationHref}
          isLoading={applications.isPending}
          ticks={{
            ticked,
            onChange: setTicked,
            can: (application) => stillOpen(application.status),
            everyLabel: 'Tick every Application shown',
          }}
          sort={{
            by: sort,
            onChange: (by) => onFiltersChange({ ...filters, sort: by as ApplicationSort }),
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

      {confirming ? (
        <EndTickedDialog
          ticked={ticked}
          onConfirm={endTicked}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
