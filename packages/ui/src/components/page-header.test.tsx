import { Button } from '@sync/ui/components/ui/button';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('names the page with its only level-one heading', () => {
    render(<PageHeader title="Dashboard" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the supporting line and the trailing actions', () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Aman Relief"
        actions={<Button>Create job</Button>}
      />,
    );

    expect(screen.getByText('Aman Relief')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create job' })).toBeInTheDocument();
  });
});
