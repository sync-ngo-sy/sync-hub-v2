import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sync/ui/components/ui/table';
import { useMediaQuery } from '@sync/ui/hooks/use-media-query';
import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  type RowData,
  type Table as TanstackTable,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  type LucideIcon,
  MoreHorizontal,
} from 'lucide-react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { EmptyState } from './empty-state';
import { placeholderKeys } from './skeletons';

export type ColumnPriority = 'primary' | 'secondary' | 'hidden';

export interface ColumnSort {
  ascending: string;
  descending: string;
  /** Which way the column arrives the first time it is asked for. Ascending unless the
   * column's own numbers only really read one way — a score is asked for best first. */
  first?: 'ascending' | 'descending';
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    priority?: ColumnPriority;
    sort?: ColumnSort;
    share?: number;
    width?: string;
  }
}

export interface DataTableSort {
  by: string;
  onChange: (by: string) => void;
}

export type DataTableColumn<TRow> = ColumnDef<TRow>;

export interface DataTableRowAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

export interface DataTableError {
  message?: string;
  onRetry: () => void;
}

export interface DataTableProps<TRow> {
  label: string;
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowId: (row: TRow) => string;
  rowLabel: (row: TRow) => string;
  onRowOpen?: (row: TRow) => void;
  rowHref?: (row: TRow) => string;
  rowActions?: (row: TRow) => DataTableRowAction[];
  isLoading?: boolean;
  error?: DataTableError;
  empty: { icon: LucideIcon; message: string; action: ReactNode };
  loadMore?: { hasMore: boolean; isLoading?: boolean; onLoadMore: () => void };
  sort?: DataTableSort;
  flush?: boolean;
  className?: string;
}

const SKELETON_ROW_KEYS = placeholderKeys(5, 'skeleton-row');
const count = new Intl.NumberFormat();

const CELL_BORDER = 'border-b border-border';
const EDGE_PADDING = '[&_tr>*:first-child]:ps-(--space-card) [&_tr>*:last-child]:pe-(--space-card)';
const TABLE_CARD = 'overflow-hidden rounded-lg border border-border bg-card shadow-card';
const LEAD_COLUMN = 'max-lg:sticky max-lg:start-0 max-lg:z-10 max-lg:bg-card';
const LEAD_HEADER = 'max-lg:sticky max-lg:start-0 max-lg:z-10 max-lg:bg-table-header';

const COMPACT = '(max-width: 47.999rem)';

function priorityOf<TRow>(cell: Cell<TRow, unknown>, index: number): ColumnPriority {
  return cell.column.columnDef.meta?.priority ?? (index === 0 ? 'primary' : 'secondary');
}

function termOf<TRow>(cell: Cell<TRow, unknown>): string {
  const { header } = cell.column.columnDef;
  return typeof header === 'string' ? header : cell.column.id;
}

const SHARE_FLOOR = '15ch';

/** A `max-width` is what lets a column hold a width the browser would otherwise widen to fit the
 * text, so the cell inside it ellipses instead of stretching the table. The `min-width` puts a floor
 * under that, because a shared column with no floor keeps giving room away until it is nothing but
 * padding; once every column is at its floor the table is wider than its box and scrolls instead. */
function columnWidths<TRow>(table: TanstackTable<TRow>): Map<string, CSSProperties> {
  const columns = table.getAllColumns();
  const shared = columns.filter((column) => column.columnDef.meta?.share);
  const total = shared.reduce((sum, column) => sum + (column.columnDef.meta?.share ?? 0), 0);

  const widths = new Map<string, CSSProperties>();

  for (const column of columns) {
    const { share, width } = column.columnDef.meta ?? {};
    if (width) widths.set(column.id, { width, maxWidth: width });
    else if (share)
      widths.set(column.id, {
        width: `${((share / total) * 100).toFixed(3)}%`,
        minWidth: SHARE_FLOOR,
        maxWidth: 0,
      });
  }

  return widths;
}

export function DataTable<TRow>({
  label,
  columns,
  data,
  getRowId,
  rowLabel,
  onRowOpen,
  rowHref,
  rowActions,
  isLoading = false,
  error,
  empty,
  loadMore,
  sort,
  flush = false,
  className,
}: DataTableProps<TRow>) {
  const compact = useMediaQuery(COMPACT);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const rows = table.getRowModel().rows;
  const widths = columnWidths(table);
  const skeletonCellKeys = placeholderKeys(columns.length + (rowActions ? 1 : 0), 'cell');
  const loadingFirstPage = isLoading && rows.length === 0;

  if (error && rows.length === 0) {
    return (
      <ErrorNotice
        error={error}
        fallback="Couldn't load this list."
        className={cn('rounded-lg border border-border bg-card px-6 py-8 shadow-card', className)}
      />
    );
  }

  if (!isLoading && rows.length === 0) {
    return <EmptyState {...empty} className={className} />;
  }

  const footer = loadingFirstPage ? null : (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        compact ? 'py-3' : 'border-t border-border bg-table-header px-(--space-card) py-3',
      )}
    >
      <p className="text-meta font-mono tabular-nums text-muted-foreground">
        {`${count.format(rows.length)} shown`}
      </p>
      {error ? <ErrorNotice error={error} fallback="Couldn't load more." /> : null}
      {!error && loadMore?.hasMore ? (
        <Button
          variant="outline"
          size="sm"
          disabled={loadMore.isLoading}
          onClick={loadMore.onLoadMore}
        >
          {loadMore.isLoading ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <div className={className}>
        <CardList
          label={label}
          rows={rows}
          rowLabel={rowLabel}
          onRowOpen={onRowOpen}
          rowHref={rowHref}
          rowActions={rowActions}
          isLoading={loadingFirstPage}
        />
        {footer}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={flush ? undefined : TABLE_CARD}>
        <Table aria-label={label} className={cn('border-separate border-spacing-0', EDGE_PADDING)}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header, index) => {
                  const sorting = sortingOf(header.column.columnDef.meta?.sort, sort);
                  const width = widths.get(header.column.id);
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorting?.direction ?? undefined}
                      style={width}
                      className={cn(
                        CELL_BORDER,
                        'bg-table-header',
                        flush && 'border-t',
                        index === 0 && LEAD_HEADER,
                      )}
                    >
                      {sorting ? (
                        <SortButton {...sorting}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </SortButton>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
                {rowActions ? (
                  <TableHead
                    className={cn(CELL_BORDER, 'w-px bg-table-header', flush && 'border-t')}
                  >
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="[&>tr:last-child>td]:border-b-0">
            {loadingFirstPage
              ? SKELETON_ROW_KEYS.map((rowKey) => (
                  <TableRow key={rowKey} aria-hidden="true">
                    {skeletonCellKeys.map((cellKey) => (
                      <TableCell key={`${rowKey}-${cellKey}`} className={CELL_BORDER}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={onRowOpen ? 'cursor-pointer' : undefined}
                    onClick={
                      onRowOpen
                        ? (event) => {
                            if (!opensElsewhere(event)) onRowOpen(row.original);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        style={widths.get(cell.column.id)}
                        className={cn(CELL_BORDER, index === 0 && cn(LEAD_COLUMN, 'font-medium'))}
                      >
                        {index === 0 && onRowOpen ? (
                          <RowOpener
                            label={rowLabel(row.original)}
                            href={rowHref?.(row.original)}
                            onOpen={() => onRowOpen(row.original)}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </RowOpener>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                    ))}
                    {rowActions ? (
                      <TableCell
                        className={cn(CELL_BORDER, 'text-end')}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActions
                          label={rowLabel(row.original)}
                          actions={rowActions(row.original)}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {footer}
      </div>
    </div>
  );
}

interface CardListProps<TRow> {
  label: string;
  rows: Row<TRow>[];
  rowLabel: (row: TRow) => string;
  onRowOpen?: (row: TRow) => void;
  rowHref?: (row: TRow) => string;
  rowActions?: (row: TRow) => DataTableRowAction[];
  isLoading: boolean;
}

function CardList<TRow>({
  label,
  rows,
  rowLabel,
  onRowOpen,
  rowHref,
  rowActions,
  isLoading,
}: CardListProps<TRow>) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-(--space-grid)" aria-hidden="true">
        {SKELETON_ROW_KEYS.map((rowKey) => (
          <div
            key={rowKey}
            className="rounded-lg border border-border bg-card p-(--space-card) shadow-card"
          >
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-3 h-3 w-4/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul aria-label={label} className="flex flex-col gap-(--space-grid)">
      {rows.map((row) => {
        const cells = row.getVisibleCells();
        const lead = cells.find((cell, index) => priorityOf(cell, index) === 'primary');
        const details = cells.filter(
          (cell, index) => priorityOf(cell, index) === 'secondary' && cell !== lead,
        );
        const actions = rowActions?.(row.original);

        return (
          <li
            key={row.id}
            className="rounded-lg border border-border bg-card p-(--space-card) shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-medium text-dense text-foreground">
                {lead && onRowOpen ? (
                  <RowOpener
                    label={rowLabel(row.original)}
                    href={rowHref?.(row.original)}
                    onOpen={() => onRowOpen(row.original)}
                  >
                    {flexRender(lead.column.columnDef.cell, lead.getContext())}
                  </RowOpener>
                ) : lead ? (
                  flexRender(lead.column.columnDef.cell, lead.getContext())
                ) : null}
              </div>
              {actions ? <RowActions label={rowLabel(row.original)} actions={actions} /> : null}
            </div>

            {details.length > 0 ? (
              <dl className="mt-3 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border pt-3">
                {details.map((cell) => (
                  <div key={cell.id} className="col-span-2 grid grid-cols-subgrid items-baseline">
                    <dt className={cn(microLabel, 'text-muted-foreground')}>{termOf(cell)}</dt>
                    <dd className="min-w-0 text-dense text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const OPENER =
  'block w-full cursor-pointer rounded-sm text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

function RowOpener({
  label,
  href,
  onOpen,
  children,
}: {
  label: string;
  href?: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  if (href === undefined) {
    return (
      <button
        type="button"
        aria-label={`Open ${label}`}
        className={OPENER}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      aria-label={`Open ${label}`}
      className={OPENER}
      onClick={(event) => {
        event.stopPropagation();
        if (opensElsewhere(event)) return;
        event.preventDefault();
        onOpen();
      }}
    >
      {children}
    </a>
  );
}

function opensElsewhere(event: MouseEvent<HTMLElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

interface Sorting {
  direction: 'ascending' | 'descending' | null;
  onSort: () => void;
}

/** Clicking the column that is already sorted turns it around; clicking any other starts it
 * ascending, which is the direction a reader expects a fresh column to arrive in — unless the
 * column says otherwise, which is for the ones whose whole point is the top of the list. */
function sortingOf(
  column: ColumnSort | undefined,
  sort: DataTableSort | undefined,
): Sorting | null {
  if (!column || !sort) return null;
  const direction =
    sort.by === column.ascending
      ? 'ascending'
      : sort.by === column.descending
        ? 'descending'
        : null;
  const unsorted = column.first === 'descending' ? column.descending : column.ascending;
  return {
    direction,
    onSort: () =>
      sort.onChange(
        direction === null
          ? unsorted
          : direction === 'ascending'
            ? column.descending
            : column.ascending,
      ),
  };
}

function SortButton({ direction, onSort, children }: Sorting & { children: ReactNode }) {
  const Arrow =
    direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        microLabel,
        'inline-flex cursor-pointer items-center gap-1 rounded-sm font-semibold outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {children}
      <Arrow
        aria-hidden="true"
        className={cn('size-3.5', !direction && 'text-muted-foreground/70')}
      />
    </button>
  );
}

function RowActions({ label, actions }: { label: string; actions: DataTableRowAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? 'destructive' : 'default'}
            onClick={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ErrorNotice({
  error,
  fallback,
  className,
}: {
  error: DataTableError;
  fallback: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3', className)}>
      <span className="flex items-center gap-2 text-dense text-muted-foreground">
        <CircleAlert aria-hidden="true" className="size-4" />
        {error.message ?? fallback}
      </span>
      <Button variant="outline" size="sm" onClick={error.onRetry}>
        Retry
      </Button>
    </div>
  );
}
