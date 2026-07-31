import { http, PROBLEM, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const CANDIDATE = { ...PROFILE, full_name: 'Amina Haddad', email: 'amina@sync.test', phone: null };

/** A live candidate session, until `deleted` flips — after which `/auth/me` reads as signed out. */
function session(state: { deleted: boolean }) {
  return [
    http.get('/v1/auth/me', ({ response }) =>
      state.deleted ? response(401).json(PROBLEM) : response(200).json(CANDIDATE),
    ),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
    // The shell's notification bell polls this while a candidate is signed in.
    http.get('/v1/notifications/unread-count', ({ response }) => response(200).json({ unread: 0 })),
  ];
}

describe('account settings and deletion', () => {
  it('presents account info and the visually separated danger zone', async () => {
    server.use(...session({ deleted: false }));

    renderApp('/settings');

    expect(await screen.findByText('Account settings')).toBeInTheDocument();
    // Scope to the page body: the candidate's name also appears in the header account menu.
    const main = within(screen.getByRole('main'));
    expect(main.getByText('Amina Haddad')).toBeInTheDocument();
    expect(main.getByText('amina@sync.test')).toBeInTheDocument();
    expect(main.getByText('Not provided')).toBeInTheDocument();
    expect(main.getByText('Danger zone')).toBeInTheDocument();
    expect(main.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
  });

  it('gates deletion behind an explicit confirmation dialog and password', async () => {
    let deletionCalls = 0;
    server.use(
      ...session({ deleted: false }),
      http.post('/v1/candidates/me/deletion', ({ response }) => {
        deletionCalls += 1;
        return response(204).empty();
      }),
    );

    renderApp('/settings');

    // Opening the danger zone's control alone deletes nothing — it only reveals the consequences.
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/permanent and cannot be undone/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Applications you've already sent stay/i)).toBeInTheDocument();

    // Confirming with no password is refused in-form, and still fires no request.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(await within(dialog).findByText('Enter your password to confirm')).toBeInTheDocument();
    expect(deletionCalls).toBe(0);
  });

  it('deletes the account with the password, then signs out to the farewell state', async () => {
    const state = { deleted: false };
    let sentPassword: string | undefined;
    server.use(
      ...session(state),
      http.post('/v1/candidates/me/deletion', async ({ request, response }) => {
        const body = (await request.json()) as { password: string };
        sentPassword = body.password;
        state.deleted = true;
        return response(204).empty();
      }),
    );

    const { router } = renderApp('/settings');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText('Confirm your password to continue'),
      'correct-horse',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account is deleted')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/goodbye'));
    expect(sentPassword).toBe('correct-horse');
    // Signed out: the header offers a way back in rather than the account menu.
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows an incorrect-password error in the dialog on a 401 and stays put', async () => {
    server.use(...session({ deleted: false }));
    // A live session (refresh succeeds) with a rejected password: the 401 is a wrong password, not
    // an expiry, so it surfaces in the dialog rather than bouncing to login. This second `use` wins
    // over the session's refresh handler, which MSW would otherwise match first.
    server.use(
      http.post('/v1/auth/refresh', ({ response }) => response(200).json(CANDIDATE)),
      http.post('/v1/candidates/me/deletion', ({ response }) => response(401).json(PROBLEM)),
    );

    const { router } = renderApp('/settings');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText('Confirm your password to continue'),
      'wrong',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await within(dialog).findByText('Incorrect password.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('bounces to login when the session has actually died before confirming', async () => {
    const state = { deleted: false };
    server.use(
      ...session(state),
      // The session lapsed while the page sat open: the profile still reads live from cache, but
      // the deletion 401s and the refresh fails, so this is a dead session, not a wrong password.
      http.post('/v1/candidates/me/deletion', ({ response }) => {
        state.deleted = true;
        return response(401).json(PROBLEM);
      }),
    );

    const { router } = renderApp('/settings');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Confirm your password to continue'), 'pw');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/settings' });
  });
});
