import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusChip } from '@sync/ui/components/status-chip';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Link } from '@tanstack/react-router';
import { Link2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useTenantTrackedLinks } from '../hooks/use-tenant-tracked-links';
import {
  LINK_FILTERS,
  type LinkFilter,
  linksMatching,
  type TenantTrackedLink,
  trackedLinkState,
} from '../tracked-link';
import { CopyAddressButton } from './copy-address-button';

const DESCRIPTION =
  'Every link your Tenant has minted, across every Job, and the Job views each one brought.';

/** Long enough that typing a word is one request rather than five. */
const SETTLE_MS = 300;

const COLUMNS: DataTableColumn<TenantTrackedLink>[] = [
  {
    id: 'name',
    header: 'Link',
    cell: ({ row }) => (
      <span className="flex min-w-40 flex-col gap-1">
        <span>{row.original.name}</span>
        <span className="text-meta font-normal text-muted-foreground">
          {`Minted ${relativeTime(row.original.created_at)}`}
        </span>
      </span>
    ),
  },
  {
    id: 'job',
    header: 'Job',
    cell: ({ row }) => (
      <Link
        to="/jobs/$jobId"
        params={{ jobId: row.original.job.id }}
        search={{}}
        className={buttonVariants({ variant: 'link', size: 'sm' })}
      >
        {row.original.job.title}
      </Link>
    ),
  },
  {
    id: 'state',
    header: 'State',
    cell: ({ row }) => {
      const state = trackedLinkState(row.original);
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
  {
    id: 'views',
    header: 'Views',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.view_count.toLocaleString()}</span>
    ),
  },
  {
    id: 'expires',
    header: 'Expires',
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

interface TenantTrackedLinksPageProps {
  q: string;
  filter: LinkFilter;
  onSearch: (q: string) => void;
  onFilterChange: (filter: LinkFilter) => void;
}

/**
 * The tenant's links, reported across every Job. It does not manage them: renaming, minting and
 * turning one off stay on the Job that owns it, which is where the row leads.
 */
export function TenantTrackedLinksPage({
  q,
  filter,
  onSearch,
  onFilterChange,
}: TenantTrackedLinksPageProps) {
  const searchId = useId();
  const [typed, setTyped] = useState(q);
  const links = useTenantTrackedLinks(q, filter);

  useEffect(() => setTyped(q), [q]);

  useEffect(() => {
    if (typed === q) return;
    const settling = setTimeout(() => onSearch(typed), SETTLE_MS);
    return () => clearTimeout(settling);
  }, [typed, q, onSearch]);

  const shown = linksMatching(links.data ?? [], filter);
  const searching = q !== '';

  return (
    <div className="space-y-8">
      <PageHeader title="Tracked links" description={DESCRIPTION} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:max-w-xs sm:flex-1">
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

        <Tabs value={filter} onValueChange={(value) => onFilterChange(value as LinkFilter)}>
          <TabsList aria-label="State">
            {LINK_FILTERS.map((state) => (
              <TabsTrigger key={state.value} value={state.value}>
                {state.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        label="Tracked links"
        columns={COLUMNS}
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
          message: searching
            ? `No tracked link matches “${q}”.`
            : 'No tracked links yet — mint one on a Job to see where its applicants come from.',
          action: (
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
  );
}
