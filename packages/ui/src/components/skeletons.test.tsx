import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CardSkeleton,
  ChartCardSkeleton,
  FactGridSkeleton,
  FormSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
  SkeletonText,
  StatCardSkeleton,
  TableSkeleton,
  TabStripSkeleton,
  ToolbarSkeleton,
} from './skeletons';

function bars(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]');
}

describe('the layout-matching skeletons', () => {
  it('gives SkeletonText one placeholder per line', () => {
    const { container } = render(<SkeletonText lines={2} />);

    expect(bars(container)).toHaveLength(2);
  });

  it('gives ListSkeleton one group of placeholders per row', () => {
    const { container } = render(<ListSkeleton rows={3} />);

    expect(bars(container)).toHaveLength(9);
  });

  it('leaves the action out of a page header that has none', () => {
    const withAction = render(<PageHeaderSkeleton action />);
    const withoutAction = render(<PageHeaderSkeleton />);

    expect(bars(withAction.container)).toHaveLength(3);
    expect(bars(withoutAction.container)).toHaveLength(2);
  });

  it('gives TableSkeleton a header row and one row of cells per row asked for', () => {
    const { container } = render(<TableSkeleton columns={4} rows={3} />);

    expect(bars(container)).toHaveLength(4 + 4 * 3);
  });

  it('gives TabStripSkeleton one placeholder per tab', () => {
    const { container } = render(<TabStripSkeleton tabs={5} />);

    expect(bars(container)).toHaveLength(5);
  });

  it('gives ToolbarSkeleton a search box and one placeholder per control', () => {
    const { container } = render(<ToolbarSkeleton controls={2} />);

    expect(bars(container)).toHaveLength(3);
  });

  it('gives FactGridSkeleton a label and a value per fact', () => {
    const { container } = render(<FactGridSkeleton facts={5} />);

    expect(bars(container)).toHaveLength(10);
  });

  it('gives CardSkeleton a title and one placeholder per line', () => {
    const { container } = render(<CardSkeleton lines={2} />);

    expect(bars(container)).toHaveLength(3);
  });

  it('gives FormSkeleton a label and a control per field, plus the submit', () => {
    const { container } = render(<FormSkeleton fields={3} />);

    expect(bars(container)).toHaveLength(7);
  });

  it('leaves the submit out of a form that does not send anything', () => {
    const { container } = render(<FormSkeleton fields={2} submit={false} />);

    expect(bars(container)).toHaveLength(4);
  });

  it('names what is arriving on the one region a reader is told about', () => {
    render(
      <RouteSkeleton label="Loading Jobs">
        <ListSkeleton rows={2} />
      </RouteSkeleton>,
    );

    expect(screen.getByRole('status', { name: 'Loading Jobs' })).toBeInTheDocument();
    expect(within(screen.getByRole('status')).queryByRole('list')).toBeNull();
  });

  it('stays out of the accessibility tree, since a placeholder says nothing', () => {
    for (const skeleton of [
      <PageHeaderSkeleton key="header" />,
      <StatCardSkeleton key="stat" />,
      <ChartCardSkeleton key="chart" />,
      <CardSkeleton key="card" />,
      <ListSkeleton key="list" />,
      <SkeletonText key="text" />,
      <TableSkeleton key="table" columns={3} />,
      <TabStripSkeleton key="tabs" tabs={3} />,
      <ToolbarSkeleton key="toolbar" />,
      <FactGridSkeleton key="facts" facts={3} />,
      <FormSkeleton key="form" />,
    ]) {
      const { container } = render(skeleton);

      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
