import type { ColumnDef } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './data-table';
import { EmptyState } from './empty-state';

interface Application {
  id: string;
  candidate: string;
  job: string;
}

const columns: ColumnDef<Application>[] = [
  { accessorKey: 'candidate', header: 'Candidate' },
  { accessorKey: 'job', header: 'Job' },
];

const lina: Application = { id: 'a1', candidate: 'Lina Khoury', job: 'Field Coordinator' };
const omar: Application = { id: 'a2', candidate: 'Omar Nassar', job: 'MEAL Officer' };
const rows: Application[] = [lina, omar];

describe('DataTable', () => {
  it('renders the named columns and a row per record', () => {
    render(<DataTable label="Applications" columns={columns} rows={rows} />);
    const table = screen.getByRole('table', { name: 'Applications' });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Job' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Lina Khoury' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'MEAL Officer' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('reports how many rows are on screen and fetches the next cursor page on demand', async () => {
    const onLoadMore = vi.fn();
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={rows}
        loadMore={{ hasMore: true, onLoadMore }}
      />,
    );
    expect(screen.getByText('Showing 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('holds Load more shut while the next page is in flight', () => {
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={rows}
        loadMore={{ hasMore: true, onLoadMore: vi.fn(), isLoadingMore: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled();
  });

  it('holds the column layout with a busy skeleton while the first page loads', () => {
    render(<DataTable label="Applications" columns={columns} rows={[]} isLoading />);
    expect(screen.getByRole('table', { name: 'Applications' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('shows the designed empty state instead of an empty grid', () => {
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={[]}
        empty={<EmptyState title="No applications yet" />}
      />,
    );
    expect(screen.getByText('No applications yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('falls back to its own empty state when a caller supplies none', () => {
    render(<DataTable label="Applications" columns={columns} rows={[]} />);
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('replaces a failed load with an announced retry, from the keyboard', async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={[]}
        error={new Error('502 upstream')}
        onRetry={onRetry}
      />,
    );
    const panel = screen.getByRole('alert');
    expect(panel).toHaveTextContent("Couldn't load");
    expect(panel).not.toHaveTextContent('502 upstream');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.tab();
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('opens the record behind a clicked row', async () => {
    const onRowOpen = vi.fn();
    render(<DataTable label="Applications" columns={columns} rows={rows} onRowOpen={onRowOpen} />);
    await userEvent.click(screen.getByRole('row', { name: /Lina Khoury/ }));
    expect(onRowOpen).toHaveBeenCalledWith(lina);
  });

  it('tells assistive tech that a focusable row can be opened', () => {
    render(<DataTable label="Applications" columns={columns} rows={rows} onRowOpen={vi.fn()} />);
    const row = screen.getByRole('row', { name: /Lina Khoury/ });
    const hintId = row.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(hintId)).toHaveTextContent('Press Enter to open');
  });

  it('walks rows with Tab and opens them with Enter or Space', async () => {
    const onRowOpen = vi.fn();
    render(<DataTable label="Applications" columns={columns} rows={rows} onRowOpen={onRowOpen} />);
    await userEvent.tab();
    expect(screen.getByRole('row', { name: /Lina Khoury/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRowOpen).toHaveBeenCalledWith(lina);

    await userEvent.tab();
    expect(screen.getByRole('row', { name: /Omar Nassar/ })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onRowOpen).toHaveBeenLastCalledWith(omar);
  });

  it('names each row action in a trailing menu and runs it on the right row', async () => {
    const onRowOpen = vi.fn();
    const shortlist = vi.fn();
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={rows}
        onRowOpen={onRowOpen}
        getRowName={(row) => row.candidate}
        actions={[
          { label: 'Shortlist', onSelect: shortlist },
          { label: 'Reject', onSelect: vi.fn() },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Omar Nassar' }));
    expect(await screen.findByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Shortlist' }));
    expect(shortlist).toHaveBeenCalledWith(omar);
    // Reaching for an action must not also open the row underneath it.
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  it('opens the action menu and picks an item with the keyboard alone', async () => {
    const onRowOpen = vi.fn();
    const shortlist = vi.fn();
    render(
      <DataTable
        label="Applications"
        columns={columns}
        rows={[lina]}
        onRowOpen={onRowOpen}
        getRowName={(row) => row.candidate}
        actions={[{ label: 'Shortlist', onSelect: shortlist }]}
      />,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Actions for Lina Khoury' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menuitem', { name: 'Shortlist' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(shortlist).toHaveBeenCalledWith(lina);
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  it('leaves rows inert when nothing opens them', () => {
    render(<DataTable label="Applications" columns={columns} rows={rows} />);
    expect(screen.getByRole('row', { name: /Lina Khoury/ })).not.toHaveAttribute('tabindex');
  });

  it('prefers the error over a stale page of rows', () => {
    render(
      <DataTable label="Applications" columns={columns} rows={rows} error={new Error('nope')} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Lina Khoury')).not.toBeInTheDocument();
  });
});
