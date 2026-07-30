import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WidgetBoundary } from './widget-boundary';

/** Flipped by the test, not by a render counter — React re-renders a failing tree more than once. */
let broken = true;

function Panel() {
  if (broken) throw new Error('panel exploded');
  return <p>Panel contents</p>;
}

beforeEach(() => {
  broken = true;
  // React logs every error it catches; the assertions below cover our own report of it.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

it('replaces a failed panel with a retryable card, and reports it', async () => {
  const user = userEvent.setup();

  render(
    <WidgetBoundary source="recent-applications" message="Couldn't load recent applications.">
      <Panel />
    </WidgetBoundary>,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load recent applications.");
  expect(console.error).toHaveBeenCalledWith(
    '[widget: recent-applications]',
    expect.objectContaining({ message: 'panel exploded' }),
  );

  broken = false;
  await user.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Panel contents')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
