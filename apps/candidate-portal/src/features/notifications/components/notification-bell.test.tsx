import { screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { listsCvs } from '@/features/cvs/testing/handlers';
import {
  countsUnread,
  countsUnreadInTurn,
  faultsOnCountingUnread,
  faultsOnListingNotifications,
  listsNotifications,
  marksRead,
} from '@/features/notifications/testing/handlers';
import {
  CANDIDATE,
  CV_FAILURE_NOTIFICATION,
  FAILED_CV,
  MOVED_NOTIFICATION,
  NOTIFICATIONS,
  SERVER_FAULT,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';
import { UNREAD_POLL_MS } from '../hooks/use-unread-count';
import { RECENT_NOTIFICATIONS } from '../notification';

function bell(unread?: number): HTMLElement {
  return screen.getByRole('button', {
    name: unread === undefined ? 'Notifications' : `Notifications, ${unread} unread`,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the notification bell', () => {
  it('carries the unread count in its name and on its badge', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnread(3));

    await renderApp('/applications');

    expect(
      within(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).getByText('3'),
    ).toBeVisible();
  });

  it('stops the badge at nine and something, rather than widening the header', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnread(24));

    await renderApp('/applications');

    expect(
      within(await screen.findByRole('button', { name: 'Notifications, 24 unread' })).getByText(
        '9+',
      ),
    ).toBeVisible();
  });

  it('wears no badge when there is nothing unread', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnread(0));

    await renderApp('/applications');

    expect(bell()).toBeVisible();
  });

  it('keeps its bell when the count cannot be fetched', async () => {
    server.use(...signedInAs(CANDIDATE), ...faultsOnCountingUnread(SERVER_FAULT));

    await renderApp('/applications');

    expect(bell()).toBeVisible();
  });

  it('refreshes the count on its own, without a navigation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(...signedInAs(CANDIDATE), ...countsUnreadInTurn(1, 4));

    await renderApp('/applications');
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible();

    await act(() => vi.advanceTimersByTimeAsync(UNREAD_POLL_MS));

    await waitFor(() => expect(bell(4)).toBeVisible());
  });

  it('refreshes the count the moment the window comes back', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnreadInTurn(1, 4));

    await renderApp('/applications');
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(bell(4)).toBeVisible());
  });
});

describe('the bell dropdown', () => {
  it('shows the most recent few, not the whole list', async () => {
    const many = Array.from({ length: RECENT_NOTIFICATIONS + 2 }, (_, index) => ({
      ...MOVED_NOTIFICATION,
      id: `00000000-0000-4000-8000-00000000031${index}`,
    }));
    server.use(...signedInAs(CANDIDATE), ...countsUnread(7), ...listsNotifications(many));

    const { user } = await renderApp('/applications');
    await user.click(bell(7));

    await waitFor(() =>
      expect(screen.getAllByRole('menuitem', { name: /Frontend Developer/ })).toHaveLength(
        RECENT_NOTIFICATIONS,
      ),
    );
  });

  it('says so when there is nothing to report', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnread(0), ...listsNotifications([]));

    const { user } = await renderApp('/applications');
    await user.click(bell());

    expect(await screen.findByText(/Nothing yet\./)).toBeVisible();
  });

  it('offers a retry when the recent list will not load', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...countsUnread(2),
      ...faultsOnListingNotifications(SERVER_FAULT),
    );

    const { user } = await renderApp('/applications');
    await user.click(bell(2));

    expect(await screen.findByText("Couldn't load these.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('opens one on its deep link, marking it read and dropping the badge', async () => {
    const read = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...countsUnreadInTurn(3, 2),
      ...listsNotifications(NOTIFICATIONS),
      ...marksRead(NOTIFICATIONS, read),
      ...listsCvs([FAILED_CV]),
    );

    const { router, user } = await renderApp('/applications');
    await user.click(bell(3));
    await user.click(await screen.findByRole('menuitem', { name: /Couldn't read/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/cvs'));
    await waitFor(() => expect(read).toHaveBeenCalledWith(CV_FAILURE_NOTIFICATION.id));
    await waitFor(() => expect(bell(2)).toBeVisible());
  });

  it('leads to the whole list', async () => {
    server.use(...signedInAs(CANDIDATE), ...countsUnread(1), ...listsNotifications(NOTIFICATIONS));

    const { router, user } = await renderApp('/applications');
    await user.click(bell(1));
    await user.click(await screen.findByRole('menuitem', { name: 'View all notifications' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/notifications'));
    expect(await screen.findByRole('list', { name: 'Notifications' })).toBeVisible();
  });
});
