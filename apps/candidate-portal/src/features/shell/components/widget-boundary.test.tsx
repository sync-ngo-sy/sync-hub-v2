import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WidgetBoundary } from './widget-boundary';

describe('a widget boundary', () => {
  it('takes down only its own panel, and its Retry re-mounts what broke', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let broken = true;

    function CurrentCv() {
      if (broken) throw new Error('the panel blew up');
      return <p>lina-khoury-cv.pdf</p>;
    }

    render(
      <>
        <p>My Applications</p>
        <WidgetBoundary name="Current CV">
          <CurrentCv />
        </WidgetBoundary>
      </>,
    );

    expect(screen.getByText('My Applications')).toBeVisible();
    expect(screen.getByText("Couldn't load this")).toBeVisible();

    broken = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('lina-khoury-cv.pdf')).toBeVisible();
  });

  it('reports the failure through the reportError seam, naming the panel', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function CurrentCv(): never {
      throw new Error('the panel blew up');
    }

    render(
      <WidgetBoundary name="Current CV">
        <CurrentCv />
      </WidgetBoundary>,
    );

    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Current CV]',
      expect.objectContaining({ message: 'the panel blew up' }),
    );
  });
});
