import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { drafts, listsCvs } from '@/features/cvs/testing/handlers';
import {
  faultsOnListingNotifications,
  faultsOnMarkingRead,
  faultsOnTheNextPage,
  listsNotificationPages,
  listsNotifications,
  marksRead,
} from '@/features/notifications/testing/handlers';
import { hasProfile } from '@/features/profile/testing/handlers';
import {
  CANDIDATE,
  CANDIDATE_PROFILE,
  CV_DRAFT,
  CV_FAILURE_NOTIFICATION,
  CV_READ_NOTIFICATION,
  FAILED_CV,
  MORE_NOTIFICATIONS,
  MOVED_NOTIFICATION,
  NOTIFICATIONS,
  READ_NOTIFICATION,
  READY_CV,
  SERVER_FAULT,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function rowFor(text: string | RegExp): HTMLElement {
  const row = screen.getByRole('link', { name: text }).closest('li');
  if (!row) throw new Error(`no row for ${String(text)}`);
  return row;
}

function filledNotice(): HTMLElement {
  const notice = screen
    .getByText('The fields below now say what your CV says')
    .closest('[data-slot="alert"]');
  if (!notice) throw new Error('no filled notice on the page');
  return notice as HTMLElement;
}

describe('the notifications page', () => {
  it('renders each payload type in its own words, newest first', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsNotifications(NOTIFICATIONS));

    await renderApp('/notifications');

    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText("Couldn't read “scan.pdf”")).toBeVisible();
    expect(
      screen.getByText('Open your profile to see why, and upload another file.'),
    ).toBeVisible();
    expect(screen.getByText('Frontend Developer (Remote) at Levant Digital')).toBeVisible();
    expect(screen.getByText('Moved from Received to In review.')).toBeVisible();
  });

  it('tells the unread from the ones already opened', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsNotifications(NOTIFICATIONS));

    await renderApp('/notifications');

    await screen.findByRole('list', { name: 'Notifications' });
    expect(within(rowFor(/Couldn't read/)).getByText('Unread.')).toBeInTheDocument();
    expect(within(rowFor(/Field Coordinator/)).queryByText('Unread.')).toBeNull();
  });

  it('marks a CV failure read and lands on the profile the CVs are on', async () => {
    const read = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotifications(NOTIFICATIONS),
      ...marksRead(NOTIFICATIONS, read),
      ...hasProfile(CANDIDATE_PROFILE),
      ...listsCvs([FAILED_CV]),
    );

    const { router, user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('link', { name: /Couldn't read/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(await screen.findByRole('heading', { name: FAILED_CV.display_name })).toBeVisible();
    await waitFor(() => expect(read).toHaveBeenCalledWith(CV_FAILURE_NOTIFICATION.id));
  });

  it('marks a read CV read, and lands on a profile already filled from it', async () => {
    const read = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotifications([CV_READ_NOTIFICATION]),
      ...marksRead([CV_READ_NOTIFICATION], read),
      ...hasProfile(CANDIDATE_PROFILE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
    );

    const { router, user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('link', { name: /has been read/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    await waitFor(() =>
      expect(screen.getByLabelText('Headline')).toHaveValue(CV_DRAFT.headline as string),
    );
    expect(within(filledNotice()).getByText(READY_CV.display_name)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo the fill' })).toBeVisible();
    await waitFor(() => expect(read).toHaveBeenCalledWith(CV_READ_NOTIFICATION.id));
  });

  it('marks a status change read and lands on the applications', async () => {
    const read = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotifications(NOTIFICATIONS),
      ...marksRead(NOTIFICATIONS, read),
    );

    const { router, user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('link', { name: /Frontend Developer/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    await waitFor(() => expect(read).toHaveBeenCalledWith(MOVED_NOTIFICATION.id));
  });

  it('leaves an already-read one alone, and still opens it', async () => {
    const read = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotifications([READ_NOTIFICATION]),
      ...marksRead([READ_NOTIFICATION], read),
    );

    const { router, user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('link', { name: /Field Coordinator/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(read).not.toHaveBeenCalled();
  });

  it('opens it anyway when marking it read fails', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotifications(NOTIFICATIONS),
      ...faultsOnMarkingRead(SERVER_FAULT),
      ...hasProfile(CANDIDATE_PROFILE),
      ...listsCvs([FAILED_CV]),
    );

    const { router, user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('link', { name: /Couldn't read/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });

  it('pages by cursor, a page at a time', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsNotificationPages(NOTIFICATIONS, MORE_NOTIFICATIONS),
    );

    const { user } = await renderApp('/notifications');

    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4));
    expect(screen.getByText('Pharmacist at Sham Care')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('blames the next page alone when Load more fails, keeping the list it has', async () => {
    server.use(...signedInAs(CANDIDATE), ...faultsOnTheNextPage(NOTIFICATIONS, SERVER_FAULT));

    const { user } = await renderApp('/notifications');
    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText(/Couldn't load the next page/)).toBeVisible();
    expect(screen.queryByText("Couldn't load your notifications")).toBeNull();
    const list = screen.getByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('says what will land here when nothing has yet', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsNotifications([]));

    await renderApp('/notifications');

    expect(await screen.findByText(/Nothing yet\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Notifications' })).toBeNull();
  });

  it('offers a retry rather than a blank page when the list will not load', async () => {
    server.use(...signedInAs(CANDIDATE), ...faultsOnListingNotifications(SERVER_FAULT));

    await renderApp('/notifications');

    expect(await screen.findByText("Couldn't load your notifications")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
