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
import { Ellipsis, LoaderCircle } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { EmptyState } from './empty-state';

interface LoadMoreState {
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
}

export interface RowAction<TRow> {
  label: string;
  onSelect: (row: TRow) => void;
}

interface DataTableProps<TRow, TValue> {
  label: string;
  columns: ColumnDef<TRow, TValue>[];
  rows: TRow[];
  getRowId?: (row: TRow) => string;
  /** Names a row's own controls, e.g. "Actions for Lina Khoury". */
  getRowName?: (row: TRow) => string;
  loadMore?: LoadMoreState;
  /** True only while the first page is in flight. */
  isLoading?: boolean;
  empty?: ReactNode;
  error?: unknown;
  onRetry?: () => void;
  onRowOpen?: (row: TRow) => void;
  actions?: RowAction<TRow>[];
}

const SKELETON_ROW_KEYS = ['a', 'b', 'c', 'd', 'e'];
const ACTIONS_COLUMN_ID = 'row-actions';
const CELL = 'px-4 py-3.5';
/** Keeps the identifying column in view while the rest of a wide table scrolls sideways. */
const LEAD_CELL = 'sticky start-0 bg-inherit';

/**
 * The action menu portals out of its row in the DOM but not in the React tree, so without
 * this its clicks and keystrokes would also open the record behind the row.
 */
const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

export function DataTable<TRow, TValue>({
  label,
  columns,
  rows,
  getRowId,
  getRowName,
  loadMore,
  isLoading,
  empty,
  error,
  onRetry,
  onRowOpen,
  actions,
}: DataTableProps<TRow, TValue>) {
  const hintId = useId();

  const actionsColumn: ColumnDef<TRow, TValue> = {
    id: ACTIONS_COLUMN_ID,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={getRowName ? `Actions for ${getRowName(row.original)}` : 'Row actions'}
          onClick={stopRowActivation}
          onKeyDown={stopRowActivation}
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          {actions?.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={(event) => {
                stopRowActivation(event);
                action.onSelect(row.original);
              }}
              onKeyDown={stopRowActivation}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const table = useReactTable({
    data: rows,
    columns: actions?.length ? [...columns, actionsColumn] : columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
      >
        <span className="text-sm text-foreground">Couldn't load this list.</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isLoading && rows.length === 0) {
    return empty ?? <EmptyState title="Nothing to show" />;
  }

  return (
    <div>
      {onRowOpen ? (
        <span id={hintId} className="sr-only">
          Press Enter to open
        </span>
      ) : null}
      <Table aria-label={label} aria-busy={isLoading}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-card hover:bg-card">
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    index === 0 && LEAD_CELL,
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? SKELETON_ROW_KEYS.map((rowKey) => (
                <TableRow key={rowKey} className="bg-card">
                  {table.getAllLeafColumns().map((column, index) => (
                    <TableCell key={column.id} className={cn(CELL, index === 0 && LEAD_CELL)}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={onRowOpen ? 0 : undefined}
                  aria-describedby={onRowOpen ? hintId : undefined}
                  onClick={onRowOpen ? () => onRowOpen(row.original) : undefined}
                  onKeyDown={
                    onRowOpen
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          onRowOpen(row.original);
                        }
                      : undefined
                  }
                  className={cn(
                    'bg-card',
                    onRowOpen &&
                      'cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  )}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        CELL,
                        index === 0 && LEAD_CELL,
                        cell.column.id === ACTIONS_COLUMN_ID && 'text-right',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {isLoading ? null : (
        <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">Showing {rows.length}</span>
          {loadMore?.hasMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore.onLoadMore}
              disabled={loadMore.isLoadingMore}
            >
              {loadMore.isLoadingMore ? <LoaderCircle className="animate-spin" /> : null}
              Load more
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
