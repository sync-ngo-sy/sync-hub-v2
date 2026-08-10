import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChipFilter } from './chip-filter';

const STAGES = [
  { value: 'all', label: 'All', count: 3 },
  { value: 'new', label: 'New', count: 2 },
  { value: 'hired', label: 'Hired', count: 0 },
];

describe('ChipFilter', () => {
  it('offers one chip per choice, each saying its own count', () => {
    render(<ChipFilter label="Pipeline" value="all" chips={STAGES} onValueChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Pipeline' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'New 2' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Hired 0' })).toBeVisible();
  });

  it('leaves the count out of the name when a chip has none', () => {
    render(
      <ChipFilter
        label="Pipeline"
        value="all"
        chips={[{ value: 'all', label: 'All' }]}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'All' })).toBeVisible();
  });

  it('marks only the chosen chip as checked', () => {
    render(<ChipFilter label="Pipeline" value="new" chips={STAGES} onValueChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'New 2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'All 3' })).not.toBeChecked();
  });

  it('says which chip was picked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ChipFilter label="Pipeline" value="all" chips={STAGES} onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Hired 0' }));

    expect(onValueChange).toHaveBeenCalledWith('hired');
  });

  it('walks the chips with the arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ChipFilter label="Pipeline" value="all" chips={STAGES} onValueChange={onValueChange} />,
    );

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(onValueChange).toHaveBeenCalledWith('new');
  });
});
