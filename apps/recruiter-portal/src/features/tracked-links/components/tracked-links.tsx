import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, Link2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useChangeTrackedLink } from '../hooks/use-tracked-link-actions';
import { useTrackedLinks } from '../hooks/use-tracked-links';
import {
  type TrackedLink,
  trackedLinkAddress,
  trackedLinkState,
  viewsPerSource,
} from '../tracked-link';
import { CopyAddressButton } from './copy-address-button';
import { LinkViewsCard } from './link-views-card';
import { MintLinkDialog } from './mint-link-dialog';
import { RenameLinkDialog } from './rename-link-dialog';

function columnsFor(shares: Map<string, number | null>): DataTableColumn<TrackedLink>[] {
  return [
    { accessorKey: 'name', header: 'Link' },
    {
      accessorKey: 'token',
      header: 'Address',
      cell: ({ row }) => {
        const address = trackedLinkAddress(row.original.token);
        return (
          <span className="flex items-center gap-2">
            <span className="max-w-64 truncate font-normal text-muted-foreground" title={address}>
              {address}
            </span>
            <CopyAddressButton link={row.original} />
          </span>
        );
      },
    },
    {
      accessorKey: 'view_count',
      header: 'Views',
      cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.view_count}</span>,
    },
    {
      id: 'share',
      header: 'Share',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {shares.get(row.original.id) === null ? '—' : `${shares.get(row.original.id) ?? 0}%`}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const state = trackedLinkState(row.original);
        return <StatusMark label={state.label} tone={state.tone} />;
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Minted',
      meta: { priority: 'hidden' },
      cell: ({ row }) => (
        <time dateTime={row.original.created_at} title={absoluteDateTime(row.original.created_at)}>
          {relativeTime(row.original.created_at)}
        </time>
      ),
    },
  ];
}

const TURNED_OFF =
  'Tracked link turned off — its address stops working, and the views it brought stay counted.';

export function TrackedLinks({ jobId }: { jobId: string }) {
  const links = useTrackedLinks(jobId);
  const change = useChangeTrackedLink(jobId);
  const [minting, setMinting] = useState(false);
  const [renaming, setRenaming] = useState<TrackedLink | null>(null);
  const [changeFailure, setChangeFailure] = useState<string | null>(null);
  const bars = useMemo(() => (links.data ? viewsPerSource(links.data) : []), [links.data]);
  const shares = useMemo(() => new Map(bars.map((row) => [row.id, row.share ?? null])), [bars]);
  const columns = useMemo(() => columnsFor(shares), [shares]);

  const items = links.data?.items ?? [];
  const listedNothing = links.isSuccess && items.length === 0;

  async function toggle(link: TrackedLink) {
    if (change.isPending) return;
    setChangeFailure(null);
    try {
      await change.mutateAsync({
        params: { path: { job_id: jobId, link_id: link.id } },
        body: { is_active: !link.is_active },
      });
      toast.success(link.is_active ? TURNED_OFF : 'Tracked link turned back on');
    } catch (error) {
      setChangeFailure(
        problemMessage(error, `“${link.name}” couldn't be changed. It is as it was.`),
      );
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {listedNothing ? null : (
        <div className="flex justify-end">
          <Button onClick={() => setMinting(true)}>
            <Plus aria-hidden="true" />
            Mint a tracked link
          </Button>
        </div>
      )}

      {links.data && (items.length > 0 || links.data.view_count > 0) ? (
        <LinkViewsCard bars={bars} viewCount={links.data.view_count} />
      ) : null}

      {changeFailure ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Tracked link unchanged</AlertTitle>
          <AlertDescription>{changeFailure}</AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        label="Tracked links"
        columns={columns}
        data={items}
        getRowId={(link) => link.id}
        rowLabel={(link) => link.name}
        rowActions={(link) => [
          { label: 'Rename link', onSelect: () => setRenaming(link) },
          {
            label: link.is_active ? 'Turn link off' : 'Turn link back on',
            onSelect: () => void toggle(link),
          },
        ]}
        isLoading={links.isPending}
        error={
          links.isError
            ? {
                message: problemMessage(links.error, "Couldn't load this Job's tracked links."),
                onRetry: () => void links.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Link2,
          message:
            'A tracked link is a named address for this Job, so you can tell which channel brought which views.',
          action: <Button onClick={() => setMinting(true)}>Mint the first link</Button>,
        }}
      />

      <MintLinkDialog jobId={jobId} open={minting} onOpenChange={setMinting} />
      {renaming ? (
        <RenameLinkDialog jobId={jobId} link={renaming} onClose={() => setRenaming(null)} />
      ) : null}
    </div>
  );
}
