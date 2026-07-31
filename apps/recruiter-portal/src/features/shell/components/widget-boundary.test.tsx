import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WidgetBoundary } from './widget-boundary';

describe('a widget boundary', () => {
  it('takes down only its own panel, and its Retry re-mounts what broke', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let broken = true;

    function TrackedLinks() {
      if (broken) throw new Error('the panel blew up');
      return <p>342 views</p>;
    }

    render(
      <>
        <p>Recent applications</p>
        <WidgetBoundary name="Tracked links">
          <TrackedLinks />
        </WidgetBoundary>
      </>,
    );

    expect(screen.getByText('Recent applications')).toBeVisible();
    expect(screen.getByText("Couldn't load this")).toBeVisible();

    broken = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('342 views')).toBeVisible();
  });

  it('reports the failure through the reportError seam, naming the panel', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function TrackedLinks(): never {
      throw new Error('the panel blew up');
    }

    render(
      <WidgetBoundary name="Tracked links">
        <TrackedLinks />
      </WidgetBoundary>,
    );

    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Tracked links]',
      expect.objectContaining({ message: 'the panel blew up' }),
    );
  });
});
