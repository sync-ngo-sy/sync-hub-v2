import { Button } from '@sync/ui/components/ui/button';
import type { ColumnDef } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableProps } from './data-table';
import { StatusChip } from './status-chip';

interface Application {
  id: string;
  candidate: string;
  job: string;
}

const COLUMNS: ColumnDef<Application>[] = [
  { accessorKey: 'candidate', header: 'Candidate' },
  { accessorKey: 'job', header: 'Job' },
  {
    id: 'status',
    header: 'Status',
    cell: () => <StatusChip tone="neutral" label="New" />,
  },
];

const APPLICATIONS: Application[] = [
  { id: 'a1', candidate: 'Lina Khoury', job: 'Field Coordinator' },
  { id: 'a2', candidate: 'Yara Salloum', job: 'Logistics Assistant' },
];

function tableWith(overrides: Partial<DataTableProps<Application>>) {
  return (
    <DataTable
      label="Applications"
      columns={COLUMNS}
      data={APPLICATIONS}
      getRowId={(application) => application.id}
      rowLabel={(application) => application.candidate}
      empty={{
        icon: Inbox,
        message: 'No applications yet — publish a job and they will land here.',
        action: <Button>Create job</Button>,
      }}
      {...overrides}
    />
  );
}

function renderTable(overrides: Partial<DataTableProps<Application>> = {}) {
  const user = userEvent.setup();
  const { rerender, ...rendered } = render(tableWith(overrides));

  return {
    ...rendered,
    user,
    rerender: (next: Partial<DataTableProps<Application>>) => rerender(tableWith(next)),
  };
}

describe('DataTable', () => {
  it('renders one row per record under its column headers, and counts what is shown', () => {
    renderTable();

    const table = screen.getByRole('table', { name: 'Applications' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Candidate', 'Job', 'Status']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Lina Khoury')).toBeInTheDocument();
    expect(screen.getByText('2 shown')).toBeInTheDocument();
  });

  it('loads the next cursor page on demand, and says so while it is loading', async () => {
    const onLoadMore = vi.fn();
    const { user, rerender } = renderTable({ loadMore: { hasMore: true, onLoadMore } });

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender({ loadMore: { hasMore: true, isLoading: true, onLoadMore } });

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('offers no Load more once the cursor is exhausted', () => {
    renderTable({ loadMore: { hasMore: false, onLoadMore: vi.fn() } });

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByText('2 shown')).toBeInTheDocument();
  });

  it('opens the row when the reader clicks anywhere in it', async () => {
    const onRowOpen = vi.fn();
    const { user } = renderTable({ onRowOpen });

    await user.click(screen.getByText('Logistics Assistant'));

    expect(onRowOpen).toHaveBeenCalledExactlyOnceWith(APPLICATIONS[1]);
  });

  it('opens the row from the keyboard, through a control that names it', async () => {
    const onRowOpen = vi.fn();
    const { user } = renderTable({ onRowOpen });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Open Lina Khoury' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onRowOpen).toHaveBeenCalledExactlyOnceWith(APPLICATIONS[0]);
  });

  it('runs a named row action from the keyboard without opening the row', async () => {
    const onSelect = vi.fn();
    const onRowOpen = vi.fn();
    const { user } = renderTable({
      onRowOpen,
      rowActions: () => [{ label: 'Move to shortlist', onSelect }],
    });

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Actions for Lina Khoury' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Move to shortlist' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  it('stands a skeleton in the table while the first page loads', () => {
    const { container } = renderTable({ data: [], isLoading: true });

    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('2 shown')).not.toBeInTheDocument();
  });

  it('offers the designed empty state instead of an empty grid', () => {
    renderTable({ data: [] });

    expect(
      screen.getByText('No applications yet — publish a job and they will land here.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create job' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('reports a first-page failure inline, with a retry', async () => {
    const onRetry = vi.fn();
    const { user } = renderTable({ data: [], error: { onRetry } });

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this list.");
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps the loaded rows on screen when a later page fails', async () => {
    const onRetry = vi.fn();
    const { user } = renderTable({
      error: { message: "Couldn't load more.", onRetry },
      loadMore: { hasMore: true, onLoadMore: vi.fn() },
    });

    expect(screen.getByText('Lina Khoury')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load more.");
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('pins the lead column so a phone can scroll the rest of the row', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toHaveClass('max-lg:sticky');
    expect(screen.getByRole('cell', { name: 'Lina Khoury' })).toHaveClass('max-lg:sticky');
  });
});
