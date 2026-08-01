import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Eyebrow } from './landing';

describe('Eyebrow', () => {
  it('labels a section without taking a heading role from it', () => {
    render(<Eyebrow>How it works</Eyebrow>);

    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('takes extra classes without losing its own', () => {
    render(<Eyebrow className="mb-4">Sync for employers</Eyebrow>);

    expect(screen.getByText('Sync for employers')).toHaveClass('mb-4', 'uppercase');
  });
});
