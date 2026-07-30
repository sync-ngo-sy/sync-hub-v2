import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './empty-state';
import { Button } from './ui/button';

describe('EmptyState', () => {
  it('renders the message and a single primary action', () => {
    render(
      <EmptyState
        title="No applications yet"
        description="They will appear here once candidates apply."
        action={<Button>Post a job</Button>}
      />,
    );
    expect(screen.getByText('No applications yet')).toBeInTheDocument();
    expect(screen.getByText('They will appear here once candidates apply.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post a job' })).toBeInTheDocument();
  });

  it('activates the action from the keyboard', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Nothing here" action={<Button onClick={onClick}>Retry</Button>} />);
    await userEvent.tab();
    const button = screen.getByRole('button', { name: 'Retry' });
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('hides a decorative icon from assistive technology', () => {
    render(<EmptyState icon={<svg role="img" aria-label="calendar" />} title="Empty" />);
    // ByRole excludes aria-hidden subtrees, so the icon must not surface in the a11y tree.
    expect(screen.queryByRole('img', { name: 'calendar' })).not.toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});
