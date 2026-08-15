import { Button } from '@sync/ui/components/ui/button';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn, type DataTableProps } from './data-table';
import { StatusMark } from './status-mark';

interface Application {
  id: string;
  candidate: string;
  job: string;
}

const COLUMNS: DataTableColumn<Application>[] = [
  { accessorKey: 'candidate', header: 'Candidate' },
  { accessorKey: 'job', header: 'Job' },
  {
    id: 'status',
    header: 'Status',
    cell: () => <StatusMark tone="new" label="New" />,
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

  it('carries the row destination as a real link, so a reader can take it to a new tab', async () => {
    const onRowOpen = vi.fn();
    const { user } = renderTable({
      onRowOpen,
      rowHref: (application) => `/applications/${application.id}`,
    });

    const opener = screen.getByRole('link', { name: 'Open Lina Khoury' });
    expect(opener).toHaveAttribute('href', '/applications/a1');

    await user.click(opener);

    expect(onRowOpen).toHaveBeenCalledExactlyOnceWith(APPLICATIONS[0]);
  });

  it('leaves a click that means another tab to the browser', async () => {
    const onRowOpen = vi.fn();
    const { user } = renderTable({
      onRowOpen,
      rowHref: (application) => `/applications/${application.id}`,
    });

    await user.keyboard('{Meta>}');
    await user.click(screen.getByRole('link', { name: 'Open Lina Khoury' }));
    await user.keyboard('{/Meta}');

    expect(onRowOpen).not.toHaveBeenCalled();
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

  it('marks a destructive row action so it reads as one', async () => {
    const { user } = renderTable({
      rowActions: () => [
        { label: 'Rename Tag', onSelect: vi.fn() },
        { label: 'Delete Tag', onSelect: vi.fn(), destructive: true },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Actions for Lina Khoury' }));

    expect(await screen.findByRole('menuitem', { name: 'Delete Tag' })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
    expect(screen.getByRole('menuitem', { name: 'Rename Tag' })).toHaveAttribute(
      'data-variant',
      'default',
    );
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

  it('pins the lead column so a narrow tablet can scroll the rest of the row', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toHaveClass('max-lg:sticky');
    expect(screen.getByRole('cell', { name: 'Lina Khoury' })).toHaveClass('max-lg:sticky');
  });
});

describe('DataTable column widths', () => {
  const MEASURED: DataTableColumn<Application>[] = [
    { accessorKey: 'candidate', header: 'Candidate', meta: { width: '30ch' } },
    { accessorKey: 'job', header: 'Job', meta: { share: 3 } },
    { id: 'status', header: 'Status', meta: { share: 1 }, cell: () => 'New' },
  ];

  function widthOf(name: string): string {
    return screen.getByRole('columnheader', { name }).getAttribute('style') ?? '';
  }

  it('holds a measured column at its measure, so long text ellipses instead of stretching', () => {
    renderTable({ columns: MEASURED });

    expect(widthOf('Candidate')).toBe('width: 30ch; max-width: 30ch;');
  });

  it('splits what is left between the shared columns, by their shares', () => {
    renderTable({ columns: MEASURED });

    expect(widthOf('Job')).toContain('width: 75%');
    expect(widthOf('Status')).toContain('width: 25%');
  });

  it('floors a shared column, so it can never give away all of its room', () => {
    renderTable({ columns: MEASURED });

    for (const name of ['Job', 'Status']) {
      expect(widthOf(name)).toContain('min-width: 15ch');
    }
  });
});

describe('DataTable sorted by a column', () => {
  const SORTABLE: DataTableColumn<Application>[] = [
    {
      accessorKey: 'candidate',
      header: 'Candidate',
      meta: { sort: { ascending: 'name', descending: 'name_reversed' } },
    },
    { accessorKey: 'job', header: 'Job' },
  ];

  it('leaves a column alone when nothing has asked for it to be sortable', () => {
    renderTable({ columns: SORTABLE });

    expect(screen.queryByRole('button', { name: 'Candidate' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Candidate' })).not.toHaveAttribute(
      'aria-sort',
    );
  });

  it('offers only the columns that say they can be sorted', () => {
    renderTable({ columns: SORTABLE, sort: { by: 'name', onChange: vi.fn() } });

    expect(screen.getByRole('button', { name: 'Candidate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Job' })).not.toBeInTheDocument();
  });

  it('says which way the sorted column is going, and says nothing on the others', () => {
    renderTable({ columns: SORTABLE, sort: { by: 'name', onChange: vi.fn() } });

    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: 'Job' })).not.toHaveAttribute('aria-sort');
  });

  it('turns the sorted column around rather than asking for the same order twice', async () => {
    const onChange = vi.fn();
    const { user } = renderTable({ columns: SORTABLE, sort: { by: 'name', onChange } });

    await user.click(screen.getByRole('button', { name: 'Candidate' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('name_reversed');
  });

  it('starts an unsorted column ascending, whichever order the table is in', async () => {
    const onChange = vi.fn();
    const { user } = renderTable({ columns: SORTABLE, sort: { by: 'newest', onChange } });

    await user.click(screen.getByRole('button', { name: 'Candidate' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('name');
  });
});

describe('DataTable on a narrow viewport', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trades the grid for one card per row, keeping the lead cell as the title', () => {
    renderTable();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Applications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Lina Khoury')).toBeInTheDocument();
  });

  it('turns the remaining columns into labelled detail rows', () => {
    renderTable();

    const [first] = within(screen.getByRole('list', { name: 'Applications' })).getAllByRole(
      'listitem',
    );
    expect(first).toHaveTextContent('Job');
    expect(first).toHaveTextContent('Field Coordinator');
    expect(first).toHaveTextContent('Status');
  });

  it('drops the columns a card has no room for', () => {
    renderTable({
      columns: [
        { accessorKey: 'candidate', header: 'Candidate' },
        { accessorKey: 'job', header: 'Job', meta: { priority: 'hidden' } },
      ],
    });

    expect(screen.getByText('Lina Khoury')).toBeInTheDocument();
    expect(screen.queryByText('Field Coordinator')).not.toBeInTheDocument();
  });

  it('still opens a row, and still counts what is shown', async () => {
    const onRowOpen = vi.fn();
    const { user } = renderTable({ onRowOpen });

    await user.click(screen.getByRole('button', { name: 'Open Yara Salloum' }));

    expect(onRowOpen).toHaveBeenCalledExactlyOnceWith(APPLICATIONS[1]);
    expect(screen.getByText('2 shown')).toBeInTheDocument();
  });
});
