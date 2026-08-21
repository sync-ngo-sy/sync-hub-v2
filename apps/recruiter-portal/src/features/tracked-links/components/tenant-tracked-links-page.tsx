import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Tabs } from '@sync/ui/components/ui/tabs';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Link2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useTenantTrackedLinks } from '../hooks/use-tenant-tracked-links';
import {
  hiddenByDate,
  LINK_FILTER_ORDER,
  LINK_FILTERS,
  type LinkFilter,
  linksMatching,
  percentageLabel,
  type TenantTrackedLink,
  trackedLinkState,
} from '../tracked-link';
import { CopyAddressButton } from './copy-address-button';

const DESCRIPTION =
  'Every link your Tenant has minted, across every Job, with the Job views each one brought and ' +
  'the Applications they became.';

const STATE_TABS = LINK_FILTER_ORDER.map((state) => ({
  value: state,
  label: LINK_FILTERS[state].label,
}));

const SETTLE_MS = 300;

export const TRACKED_LINK_COLUMNS: DataTableColumn<TenantTrackedLink>[] = [
  {
    id: 'name',
    header: 'Link',
    meta: { share: 3 },
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col gap-1">
        <TruncatedText>{row.original.name}</TruncatedText>
        <TruncatedText className="text-meta font-normal text-muted-foreground">
          {`Minted ${relativeTime(row.original.created_at)}`}
        </TruncatedText>
      </span>
    ),
  },
  {
    id: 'job',
    header: 'Job',
    meta: { width: '25ch' },
    cell: ({ row }) => (
      <Link
        to="/jobs/$jobId"
        params={{ jobId: row.original.job.id }}
        search={{}}
        className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'max-w-full')}
      >
        <TruncatedText className="min-w-0">{row.original.job.title}</TruncatedText>
      </Link>
    ),
  },
  {
    id: 'state',
    header: 'State',
    cell: ({ row }) => {
      const state = trackedLinkState(row.original);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  },
  {
    id: 'views',
    header: 'Views',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.view_count.toLocaleString()}</span>
    ),
  },
  {
    id: 'applications',
    header: 'Applications',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.original.application_count.toLocaleString()}
      </span>
    ),
  },
  {
    id: 'conversion',
    header: 'Conversion',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {percentageLabel(row.original.conversion_rate)}
      </span>
    ),
  },
  {
    id: 'expires',
    header: 'Expires',
    meta: { priority: 'hidden' },
    cell: ({ row }) =>
      row.original.expires_at ? (
        <time
          dateTime={row.original.expires_at}
          title={absoluteDateTime(row.original.expires_at)}
          className="text-muted-foreground"
        >
          {relativeTime(row.original.expires_at)}
        </time>
      ) : (
        <span className="text-muted-foreground">Never</span>
      ),
  },
  {
    id: 'address',
    header: 'Address',
    cell: ({ row }) => <CopyAddressButton link={row.original} />,
  },
];

function emptyMessage({
  q,
  filter,
  hidden,
  more,
}: {
  q: string;
  filter: LinkFilter;
  hidden: boolean;
  more: boolean;
}): string {
  if (q !== '') return `No tracked link matches “${q}”.`;
  if (!hidden) {
    return 'No tracked links yet — mint one on a Job to see where its applicants come from.';
  }
  const state = LINK_FILTERS[filter].label.toLowerCase();
  return more
    ? `No ${state} link so far — there are more to read through.`
    : `None of your tracked links are ${state}.`;
}

interface TenantTrackedLinksPageProps {
  q: string;
  filter: LinkFilter;
  onSearch: (q: string) => void;
  onFilterChange: (filter: LinkFilter) => void;
}

export function TenantTrackedLinksPage({
  q,
  filter,
  onSearch,
  onFilterChange,
}: TenantTrackedLinksPageProps) {
  const searchId = useId();
  const [typed, setTyped] = useState(q);
  const settled = useRef(q);
  const links = useTenantTrackedLinks(q, filter);

  useEffect(() => {
    if (q === settled.current) return;
    settled.current = q;
    setTyped(q);
  }, [q]);

  useEffect(() => {
    if (typed === settled.current) return;
    const settling = setTimeout(() => {
      settled.current = typed;
      onSearch(typed);
    }, SETTLE_MS);
    return () => clearTimeout(settling);
  }, [typed, onSearch]);

  const arrived = links.data ?? [];
  const shown = linksMatching(arrived, filter);
  const hidden = hiddenByDate(arrived, filter);

  return (
    <>
      <WorkspaceHeader withTabs>
        <PageHeader title="Tracked links" description={DESCRIPTION} />
        <Tabs
          className="gap-0"
          value={filter}
          onValueChange={(value) => onFilterChange(value as LinkFilter)}
        >
          <LineTabsList label="State" value={filter} tabs={STATE_TABS} className="-mb-px mt-5" />
        </Tabs>
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <div className="flex max-w-xs flex-col gap-1.5">
          <label htmlFor={searchId} className="text-meta text-muted-foreground">
            Search by name
          </label>
          <Input
            id={searchId}
            type="search"
            value={typed}
            placeholder="LinkedIn, WhatsApp…"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>

        <DataTable
          label="Tracked links"
          columns={TRACKED_LINK_COLUMNS}
          data={shown}
          getRowId={(link) => link.id}
          rowLabel={(link) => `${link.name} on ${link.job.title}`}
          isLoading={links.isPending}
          error={
            links.error
              ? {
                  message: problemMessage(links.error, "Couldn't load your tracked links."),
                  onRetry: () => void links.refetch(),
                }
              : undefined
          }
          empty={{
            icon: Link2,
            message: emptyMessage({ q, filter, hidden, more: links.hasNextPage }),
            action: hidden ? (
              <Button disabled={!links.hasNextPage} onClick={() => void links.fetchNextPage()}>
                Keep looking
              </Button>
            ) : (
              <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
                Go to Jobs
              </Link>
            ),
          }}
          loadMore={{
            hasMore: links.hasNextPage,
            isLoading: links.isFetchingNextPage,
            onLoadMore: () => void links.fetchNextPage(),
          }}
        />
      </div>
    </>
  );
}
