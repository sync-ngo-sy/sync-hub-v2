import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  changesPassword,
  refusesNewPassword,
  rejectsCurrentPassword,
  signedInAs,
} from '@/features/auth/testing/handlers';
import { RANA } from '@/features/team/testing/fixtures';
import { listsMembers } from '@/features/team/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function findPasswordForm(): Promise<HTMLElement> {
  const form = (await screen.findByLabelText('New password')).closest('form');
  if (!form) throw new Error('the new-password field is not inside a form');
  return form;
}

describe('Account settings', () => {
  it('shows the recruiter their own identity, apart from the Tenant settings', async () => {
    server.use(...signedInAs(RECRUITER));

    await renderApp('/account');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Account settings' }),
    ).toBeVisible();
    const page = within(screen.getByRole('main'));
    expect(page.getByText(RECRUITER.full_name)).toBeVisible();
    expect(page.getByText(RECRUITER.email)).toBeVisible();
    expect(screen.queryByRole('tablist', { name: 'Workspace settings' })).toBeNull();
  });

  it('is reachable from the account menu, not the workspace navigation', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([RANA]));

    const { router, user } = await renderApp('/settings');
    await user.click(
      await screen.findByRole('button', { name: `Account: ${RECRUITER.full_name}` }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Account settings' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
  });

  it('changes the password and says the other devices were signed out', async () => {
    const changed = vi.fn();
    server.use(...signedInAs(RECRUITER), ...changesPassword(changed));

    const { user } = await renderApp('/account');
    const form = within(await findPasswordForm());
    await user.type(form.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(form.getByLabelText('New password'), 'A-Brand-New-One1');
    await user.click(form.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith({
        current_password: 'Correct-Horse9',
        new_password: 'A-Brand-New-One1',
      }),
    );
    expect(await screen.findByText(/signed out everywhere else/i)).toBeVisible();
    expect(form.getByLabelText('Current password')).toHaveValue('');
  });

  it('puts a wrong current password on the field the recruiter must correct', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...rejectsCurrentPassword({
        type: 'urn:sync:problem:invalid-credentials',
        title: 'Unauthorized',
        status: 401,
        detail: 'That is not your current password.',
      }),
    );

    const { user } = await renderApp('/account');
    const form = within(await findPasswordForm());
    await user.type(form.getByLabelText('Current password'), 'wrong-password');
    await user.type(form.getByLabelText('New password'), 'A-Brand-New-One1');
    await user.click(form.getByRole('button', { name: 'Change password' }));

    expect(await form.findByText('That is not your current password.')).toBeVisible();
    expect(form.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts a refused new password on the new-password field', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...refusesNewPassword({
        type: 'urn:sync:problem:password-unchanged',
        title: 'Bad Request',
        status: 400,
        detail: 'Choose a password you have not used on this account before.',
      }),
    );

    const { user } = await renderApp('/account');
    const form = within(await findPasswordForm());
    await user.type(form.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(form.getByLabelText('New password'), 'Correct-Horse9');
    await user.click(form.getByRole('button', { name: 'Change password' }));

    expect(
      await form.findByText('Choose a password you have not used on this account before.'),
    ).toBeVisible();
    expect(form.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends nothing when the new password fails the policy the form already states', async () => {
    const changed = vi.fn();
    server.use(...signedInAs(RECRUITER), ...changesPassword(changed));

    const { user } = await renderApp('/account');
    const form = within(await findPasswordForm());
    await user.type(form.getByLabelText('Current password'), 'Correct-Horse9');
    await user.type(form.getByLabelText('New password'), 'short');
    await user.click(form.getByRole('button', { name: 'Change password' }));

    expect(await form.findByText('Use at least 8 characters.')).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
  });
});
