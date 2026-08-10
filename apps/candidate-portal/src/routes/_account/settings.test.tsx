import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  deletesAccount,
  refusesAccountDeletion,
  withholdsAccountDeletion,
} from '@/features/settings/testing/handlers';
import { CANDIDATE } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('Account settings', () => {
  it('shows account information and separates deletion with honest consequences', async () => {
    server.use(...signedInAs(CANDIDATE));

    await renderApp('/settings');

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeVisible();
    expect(screen.getByText(CANDIDATE.full_name)).toBeVisible();
    expect(screen.getByText(CANDIDATE.email)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeVisible();
    expect(screen.getByText(/profile and CVs will be removed/i)).toBeVisible();
    expect(screen.getByText(/employers can still read.*Applications/i)).toBeVisible();
  });

  it('sends no deletion request before the candidate supplies their current password', async () => {
    const deleted = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...deletesAccount(deleted));

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Current password')).toHaveAttribute('type', 'password');
    expect(
      within(dialog).getByRole('button', { name: 'Delete account permanently' }),
    ).toBeDisabled();
    expect(deleted).not.toHaveBeenCalled();
  });

  it('deletes with the password, clears account state, and ends on a signed-out farewell', async () => {
    const deleted = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...deletesAccount(deleted));

    const { queryClient, router, user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Delete account permanently' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/account-deleted'));
    expect(deleted).toHaveBeenCalledWith({ password: 'correct-horse-battery' });
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toBeUndefined();
    expect(
      await screen.findByRole('heading', { name: 'Your account has been deleted' }),
    ).toBeVisible();
    expect(screen.getByText(/Thanks for being part of Sync Hub/)).toBeVisible();
    expect(screen.queryByRole('button', { name: `Account: ${CANDIDATE.full_name}` })).toBeNull();
  });

  it('keeps a wrong-password rejection inside the confirmation', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...refusesAccountDeletion({
        type: 'urn:sync:problem:invalid-credentials',
        title: 'Unauthorized',
        status: 401,
        detail: 'That is not your password. Deleting an account needs it.',
      }),
    );

    const { router, user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Delete account permanently' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('That is not your password. Deleting an account needs it.'),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Delete account permanently' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('locks the confirmation while the deletion request is running', async () => {
    server.use(...signedInAs(CANDIDATE), ...withholdsAccountDeletion());

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Delete account permanently' }));

    expect(await screen.findByRole('button', { name: 'Deleting account…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep my account' })).toBeDisabled();
    expect(screen.getByLabelText('Current password')).toBeDisabled();
  });
});
