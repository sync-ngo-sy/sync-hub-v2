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
import { placeholderKeys } from './skeletons';

export type DataTableColumn<TRow> = ColumnDef<TRow>;

export interface DataTableRowAction {
  label: string;
  onSelect: () => void;
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
  rowActions?: (row: TRow) => DataTableRowAction[];
  isLoading?: boolean;
  error?: DataTableError;
  empty: { icon: LucideIcon; message: string; action: ReactNode };
  loadMore?: { hasMore: boolean; isLoading?: boolean; onLoadMore: () => void };
  className?: string;
}

const SKELETON_ROW_KEYS = placeholderKeys(5, 'skeleton-row');
const count = new Intl.NumberFormat();

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
  const skeletonCellKeys = placeholderKeys(columns.length + (rowActions ? 1 : 0), 'cell');

  if (error && rows.length === 0) {
    return (
      <ErrorNotice
        error={error}
        fallback="Couldn't load this list."
        className={cn('rounded-lg border border-border px-6 py-8', className)}
      />
    );
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
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-meta tabular-nums text-muted-foreground">
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
          <DropdownMenuItem key={action.label} onClick={action.onSelect}>
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
