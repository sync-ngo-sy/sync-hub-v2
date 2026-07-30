import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';
import { Button } from './ui/button';

describe('PageHeader', () => {
  it('renders the title as a level-1 heading with its description and actions', () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Where you start each day."
        actions={<Button>New job</Button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Where you start each day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New job' })).toBeInTheDocument();
  });
});
