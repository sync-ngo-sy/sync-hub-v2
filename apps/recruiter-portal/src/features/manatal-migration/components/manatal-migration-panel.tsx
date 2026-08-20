import type { components } from '@sync/api-client/schema';
import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatBand, StatBandSkeleton } from '@sync/ui/components/stat-band';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { Button } from '@sync/ui/components/ui/button';
import { AlertCircle, FileCheck2, RefreshCw, Upload, UserCheck, Users } from 'lucide-react';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { useMembers } from '@/features/team/hooks/use-members';
import { isTenantAdmin } from '@/features/team/member';
import { problemMessage } from '@/lib/api-problem';
import { useManatalMigrationStatus } from '../hooks/use-manatal-migration-status';
import { useStartManatalMigration } from '../hooks/use-start-manatal-migration';
import { parseStatusLabel, progressLabel, type ManatalMigrationRecent } from '../migration';

type ManatalMigrationStatus = components['schemas']['ManatalMigrationStatus'];

const RECENT_COLUMNS: DataTableColumn<ManatalMigrationRecent>[] = [
  {
    accessorKey: 'full_name',
    header: 'Candidate',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.full_name}</TruncatedText>,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: { share: 3 },
    cell: ({ row }) => (
      <TruncatedText className="font-normal text-muted-foreground">{row.original.email}</TruncatedText>
    ),
  },
  {
    id: 'account',
    header: 'Account',
    cell: ({ row }) => (
      <StatusMark
        label={row.original.is_claimed ? 'Claimed' : 'Unclaimed'}
        tone={row.original.is_claimed ? 'positive' : 'neutral'}
      />
    ),
  },
  {
    id: 'cv',
    header: 'CV',
    cell: ({ row }) => (
      <StatusMark
        label={parseStatusLabel(row.original.parsing_status)}
        tone={row.original.parsing_status === 'failed' ? 'negative' : 'neutral'}
      />
    ),
  },
  {
    id: 'published',
    header: 'Searchable',
    cell: ({ row }) => (
      <StatusMark
        label={row.original.is_searchable ? 'Yes' : 'Not yet'}
        tone={row.original.is_searchable ? 'positive' : 'neutral'}
      />
    ),
  },
];

export function ManatalMigrationPanel({ profileId }: { profileId: string }) {
  const members = useMembers();
  const status = useManatalMigrationStatus();
  const start = useStartManatalMigration();
  const mayAdminister = members.data ? isTenantAdmin(members.data, profileId) : false;

  if (members.isPending) {
    return <StatBandSkeleton labels={['Loading']} variant="cards" />;
  }

  if (!mayAdminister) {
    return (
      <Alert>
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Only an admin can follow the Manatal import</AlertTitle>
        <AlertDescription>
          Ask one of your admins to open this tab while candidates are being brought across.
        </AlertDescription>
      </Alert>
    );
  }

  if (status.isPending && !status.data) {
    return (
      <div role="status" aria-label="Loading Manatal migration progress">
        <StatBandSkeleton
          labels={['Imported', 'Published', 'Unclaimed', 'Awaiting CV read']}
          variant="cards"
        />
      </div>
    );
  }

  const body: ManatalMigrationStatus | undefined = status.data;

  return (
    <div className="space-y-6">
      {status.error ? (
        <RetryNotice
          message={problemMessage(status.error, "Couldn't read the Manatal import progress.")}
          onRetry={() => void status.refetch()}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Manatal import</CardTitle>
            <CardDescription>
              Candidates brought across from Manatal into your talent pool. Start a batch here,
              then refresh while the worker runs.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {body?.may_start ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={start.isPending}
                  onClick={() =>
                    void start.mutateAsync({ body: { action: 'import' } }).catch(() => undefined)
                  }
                >
                  <Upload aria-hidden="true" />
                  Import from Manatal
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={start.isPending}
                  onClick={() =>
                    void start.mutateAsync({ body: { action: 'publish' } }).catch(() => undefined)
                  }
                >
                  <FileCheck2 aria-hidden="true" />
                  Publish parsed profiles
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void status.refetch()}
              disabled={status.isFetching}
            >
              <RefreshCw aria-hidden="true" className={status.isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {body ? progressLabel(body.counts) : '—'}
          </p>

          <StatBand
            variant="cards"
            items={[
              {
                label: 'Imported',
                value: String(body?.counts.total ?? '—'),
                icon: Users,
              },
              {
                label: 'Published',
                value: String(body?.counts.published ?? '—'),
                icon: FileCheck2,
              },
              {
                label: 'Unclaimed',
                value: String(body?.counts.unclaimed ?? '—'),
                icon: UserCheck,
              },
              {
                label: 'Awaiting CV read',
                value: String(body?.counts.awaiting_parse ?? '—'),
                icon: RefreshCw,
              },
            ]}
          />

          {start.error ? (
            <RetryNotice
              message={problemMessage(start.error, "Couldn't start the Manatal batch.")}
              onRetry={() => start.reset()}
            />
          ) : null}

          {body && !body.configured ? (
            <Alert>
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Manatal import is not configured here</AlertTitle>
              <AlertDescription>
                Your platform team must set Manatal credentials on this environment before a batch
                can run from the dashboard.
              </AlertDescription>
            </Alert>
          ) : body && body.configured && !body.may_start ? (
            <Alert>
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Only the importing recruiter can start a batch</AlertTitle>
              <AlertDescription>
                Manatal import is tied to one recruiter account in this environment. Ask that admin
                to run Import and Publish from this tab.
              </AlertDescription>
            </Alert>
          ) : body ? (
            <p className="text-sm text-muted-foreground">
              Queue: {body.queue.jobs_pending} waiting, {body.queue.jobs_processing} running
              {body.queue.ledger_imported > 0
                ? ` · ${body.queue.ledger_imported} imported and awaiting publish`
                : ''}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent imports</CardTitle>
          <CardDescription>
            The twenty most recently saved Manatal candidates in your pool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {body && body.recent.length > 0 ? (
            <DataTable columns={RECENT_COLUMNS} data={body.recent} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Once the import starts, each saved candidate appears in this list.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
