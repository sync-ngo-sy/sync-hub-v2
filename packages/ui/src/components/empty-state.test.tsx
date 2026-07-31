import { Button } from '@sync/ui/components/ui/button';
import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('says what is missing and offers the one next action', () => {
    render(
      <EmptyState
        icon={Inbox}
        message="No applications yet — publish a job and they will land here."
        action={<Button>Create job</Button>}
      />,
    );

    expect(
      screen.getByText('No applications yet — publish a job and they will land here.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create job' })).toBeInTheDocument();
  });

  it('keeps its icon out of the accessibility tree, since the sentence carries the meaning', () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        message="No tracked links yet."
        action={<Button>Mint a link</Button>}
      />,
    );

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
