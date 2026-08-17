import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import {
  changesPassword,
  refusesNewPassword,
  rejectsCurrentPassword,
  signedInAs,
} from '@/features/auth/testing/handlers';
import {
  deletesAccount,
  refusesAccountDeletion,
  withholdsAccountDeletion,
} from '@/features/settings/testing/handlers';
import { CANDIDATE } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function findPasswordForm(): Promise<HTMLElement> {
  const form = (await screen.findByLabelText('New password')).closest('form');
  if (!form) throw new Error('the new-password field is not inside a form');
  return form;
}

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

  it('changes the password and says the other devices were signed out', async () => {
    const changed = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...changesPassword(changed));

    const { user } = await renderApp('/settings');
    const card = within(await findPasswordForm());
    await user.type(card.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(card.getByLabelText('New password'), 'A-Brand-New-One1');
    await user.click(card.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith({
        current_password: 'Correct-Horse9',
        new_password: 'A-Brand-New-One1',
      }),
    );
    expect(await screen.findByText(/signed out everywhere else/i)).toBeVisible();
    expect(card.getByLabelText('Current password')).toHaveValue('');
  });

  it('puts a wrong current password on the field the candidate must correct', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...rejectsCurrentPassword({
        type: 'urn:sync:problem:invalid-credentials',
        title: 'Unauthorized',
        status: 401,
        detail: 'That is not your current password.',
      }),
    );

    const { user } = await renderApp('/settings');
    const card = within(await findPasswordForm());
    await user.type(card.getByLabelText('Current password'), 'wrong-password');
    await user.type(card.getByLabelText('New password'), 'A-Brand-New-One1');
    await user.click(card.getByRole('button', { name: 'Change password' }));

    expect(await card.findByText('That is not your current password.')).toBeVisible();
    expect(card.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts a refused new password on the new-password field', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...refusesNewPassword({
        type: 'urn:sync:problem:password-unchanged',
        title: 'Bad Request',
        status: 400,
        detail: 'Choose a password you have not used on this account before.',
      }),
    );

    const { user } = await renderApp('/settings');
    const card = within(await findPasswordForm());
    await user.type(card.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(card.getByLabelText('New password'), 'Correct-Horse9');
    await user.click(card.getByRole('button', { name: 'Change password' }));

    expect(
      await card.findByText('Choose a password you have not used on this account before.'),
    ).toBeVisible();
    expect(card.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends nothing when the new password fails the policy the form already states', async () => {
    const changed = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...changesPassword(changed));

    const { user } = await renderApp('/settings');
    const card = within(await findPasswordForm());
    await user.type(card.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(card.getByLabelText('New password'), 'short');
    await user.click(card.getByRole('button', { name: 'Change password' }));

    expect(await card.findByText('Use at least 8 characters.')).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
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
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Current password'), 'correct-horse-battery');
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
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Current password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Delete account permanently' }));

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
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Delete account permanently' }));

    expect(await screen.findByRole('button', { name: 'Deleting account…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep my account' })).toBeDisabled();
    expect(within(dialog).getByLabelText('Current password')).toBeDisabled();
  });
});
