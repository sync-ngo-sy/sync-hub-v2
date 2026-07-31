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
import { cn } from '@sync/ui/lib/utils';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CircleAlert, type LucideIcon, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';

/** Re-exported so a portal defines columns without depending on TanStack Table itself. */
export type DataTableColumn<TRow> = ColumnDef<TRow>;

export interface DataTableRowAction {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
}

export interface DataTableProps<TRow> {
  /** Names the grid for assistive technology, and is the noun the footer counts. */
  label: string;
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowId: (row: TRow) => string;
  /** Names each row for the controls that act on it. */
  rowLabel: (row: TRow) => string;
  onRowOpen?: (row: TRow) => void;
  rowActions?: (row: TRow) => DataTableRowAction[];
  isLoading?: boolean;
  error?: { message?: string; onRetry: () => void };
  empty: { icon: LucideIcon; message: string; action: ReactNode };
  /** Cursor pages, never page numbers: the API knows no totals. */
  loadMore?: { hasMore: boolean; isLoading?: boolean; onLoadMore: () => void };
  className?: string;
}

const SKELETON_ROW_KEYS = ['first', 'second', 'third', 'fourth', 'fifth'];

// A sticky cell needs separated borders to keep its own hairline while the rest of the row
// scrolls under it, so the row border moves onto the cells.
const CELL_BORDER = 'border-b border-border';
const LEAD_COLUMN = 'max-lg:sticky max-lg:start-0 max-lg:z-10 max-lg:bg-card';

export function DataTable<TRow>({
  label,
  columns,
  data,
  getRowId,
  rowLabel,
  onRowOpen,
  rowActions,
  isLoading = false,
  error,
  empty,
  loadMore,
  className,
}: DataTableProps<TRow>) {
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
  const span = columns.length + (rowActions ? 1 : 0);
  const skeletonCellKeys = Array.from({ length: span }, (_, index) => `cell-${index}`);

  if (error && rows.length === 0) {
    return <InlineError message={error.message} onRetry={error.onRetry} className={className} />;
  }

  if (!isLoading && rows.length === 0) {
    return <EmptyState {...empty} className={className} />;
  }

  return (
    <div className={className}>
      <Table aria-label={label} className="border-separate border-spacing-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(CELL_BORDER, 'bg-card', index === 0 && LEAD_COLUMN)}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
              {rowActions ? (
                <TableHead className={cn(CELL_BORDER, 'w-px bg-card')}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading && rows.length === 0
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
                  onClick={onRowOpen ? () => onRowOpen(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(CELL_BORDER, index === 0 && cn(LEAD_COLUMN, 'font-medium'))}
                    >
                      {index === 0 && onRowOpen ? (
                        <button
                          type="button"
                          aria-label={`Open ${rowLabel(row.original)}`}
                          className="rounded-sm text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRowOpen(row.original);
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </button>
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

      {isLoading && rows.length === 0 ? null : (
        <Footer shown={rows.length} error={error} loadMore={error ? undefined : loadMore} />
      )}
    </div>
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
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
            {action.icon ? <action.icon /> : null}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Footer({
  shown,
  error,
  loadMore,
}: {
  shown: number;
  error?: DataTableProps<never>['error'];
  loadMore?: DataTableProps<never>['loadMore'];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-meta tabular-nums text-muted-foreground">{`${shown} shown`}</p>
      {error ? (
        <span role="alert" className="flex items-center gap-2 text-meta text-muted-foreground">
          <CircleAlert aria-hidden="true" className="size-4" />
          {error.message ?? "Couldn't load more."}
          <Button variant="outline" size="sm" onClick={error.onRetry}>
            Retry
          </Button>
        </span>
      ) : null}
      {loadMore?.hasMore ? (
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
}

function InlineError({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border px-6 py-8',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <CircleAlert aria-hidden="true" className="size-4.5 text-muted-foreground" />
        <p className="text-dense text-foreground">{message ?? "Couldn't load this list."}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
