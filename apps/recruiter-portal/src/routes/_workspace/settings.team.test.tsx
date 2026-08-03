import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  ADMIN_ONLY,
  EMAIL_TAKEN,
  LAST_ADMIN,
  LAYLA,
  OMAR,
  RANA,
} from '@/features/team/testing/fixtures';
import {
  listsMembers,
  managesTeam,
  refusesMemberChange,
  refusesMemberChangeToNonAdmins,
  refusesTeamInvite,
  refusesTeamInviteToNonAdmins,
} from '@/features/team/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function rowOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(name) }));
}

async function openActions(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('the Team tab', () => {
  it('lists everyone on the roster with their role and their access', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([RANA, OMAR, LAYLA]));

    await renderApp('/settings');

    expect(await screen.findByText('Omar Zayed')).toBeVisible();
    expect(rowOf('Rana Aljabri').getByText('Admin')).toBeVisible();
    expect(rowOf('Omar Zayed').getByText('omar@aman.test')).toBeVisible();
    expect(rowOf('Omar Zayed').getByText('Recruiter')).toBeVisible();
    expect(rowOf('Omar Zayed').getByText('Active')).toBeVisible();
    expect(rowOf('Layla Haddad').getByText('No access')).toBeVisible();
  });

  it('invites a teammate, reports the invitation, and puts them on the roster', async () => {
    const onInvite = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA], { onInvite }));

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Full name'), 'Omar Zayed');
    await user.type(screen.getByLabelText('Email'), 'omar@aman.test');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledExactlyOnceWith({
        full_name: 'Omar Zayed',
        email: 'omar@aman.test',
        role: 'recruiter',
      }),
    );
    expect(await screen.findByText('Invitation sent to omar@aman.test')).toBeVisible();
    expect(await screen.findByText('Omar Zayed')).toBeVisible();
  });

  it('invites an admin when that is the role chosen', async () => {
    const onInvite = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA], { onInvite }));

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Full name'), 'Nadia Saab');
    await user.type(screen.getByLabelText('Email'), 'nadia@aman.test');
    await user.click(screen.getByRole('radio', { name: /Admin/ }));
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledExactlyOnceWith({
        full_name: 'Nadia Saab',
        email: 'nadia@aman.test',
        role: 'admin',
      }),
    );
  });

  it('validates the invitation beside its fields before anything is sent', async () => {
    const onInvite = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA], { onInvite }));

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Email'), 'not-an-address');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Give the teammate’s name.')).toBeVisible();
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('puts an address that already has an account beneath the email field', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...refusesTeamInvite(EMAIL_TAKEN),
    );

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Full name'), 'Omar Zayed');
    await user.type(screen.getByLabelText('Email'), 'omar@aman.test');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(
      await screen.findByText('An account already exists for this email address.'),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('asks before a role change, and leaves the roster alone if the admin backs out', async () => {
    const onChange = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA, OMAR], { onChange }));

    const { user } = await renderApp('/settings');
    await openActions(user, 'Omar Zayed');
    await user.click(await screen.findByRole('menuitem', { name: 'Make admin' }));

    const asking = await screen.findByRole('alertdialog');
    expect(asking).toHaveTextContent('Make Omar Zayed an admin?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(rowOf('Omar Zayed').getByText('Recruiter')).toBeVisible();
  });

  it('promotes a colleague once confirmed, and reads the roster back', async () => {
    const onChange = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA, OMAR], { onChange }));

    const { user } = await renderApp('/settings');
    await openActions(user, 'Omar Zayed');
    await user.click(await screen.findByRole('menuitem', { name: 'Make admin' }));
    await user.click(screen.getByRole('button', { name: 'Make admin' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(OMAR.id, { role: 'admin' }),
    );
    expect(await screen.findByText('Omar Zayed is now an admin')).toBeVisible();
    await waitFor(() => expect(rowOf('Omar Zayed').getByText('Admin')).toBeVisible());
  });

  it('revokes a colleague’s access, saying what that leaves them', async () => {
    const onChange = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA, OMAR], { onChange }));

    const { user } = await renderApp('/settings');
    await openActions(user, 'Omar Zayed');
    await user.click(await screen.findByRole('menuitem', { name: 'Revoke access' }));

    const asking = within(await screen.findByRole('alertdialog'));
    expect(
      asking.getByText(
        'They can no longer sign in. They stay on the roster, and everything they wrote stays with your Tenant — an admin can give their access back.',
      ),
    ).toBeVisible();
    await user.click(asking.getByRole('button', { name: 'Revoke access' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(OMAR.id, { is_active: false }),
    );
    expect(await screen.findByText('Omar Zayed can no longer sign in')).toBeVisible();
    await waitFor(() => expect(rowOf('Omar Zayed').getByText('No access')).toBeVisible());
  });

  it('offers a colleague with no access one move, and gives it back', async () => {
    const onChange = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA, LAYLA], { onChange }));

    const { user } = await renderApp('/settings');
    await openActions(user, 'Layla Haddad');

    expect(await screen.findByRole('menuitem', { name: 'Give access back' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Revoke access' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Give access back' }));
    await user.click(screen.getByRole('button', { name: 'Give access back' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(LAYLA.id, { is_active: true }),
    );
    expect(await screen.findByText('Layla Haddad can sign in again')).toBeVisible();
    await waitFor(() => expect(rowOf('Layla Haddad').getByText('Active')).toBeVisible());
  });

  it('reads a refused change in the server’s words, beside the button that asked for it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA, { ...OMAR, role: 'admin' }]),
      ...refusesMemberChange(LAST_ADMIN),
    );

    const { user } = await renderApp('/settings');
    await openActions(user, 'Omar Zayed');
    await user.click(await screen.findByRole('menuitem', { name: 'Make recruiter' }));
    await user.click(screen.getByRole('button', { name: 'Make recruiter' }));

    const asking = within(await screen.findByRole('alertdialog'));
    expect(
      await asking.findByText('A tenant has to keep at least one active admin.'),
    ).toBeVisible();
    expect(asking.getByText('Omar Zayed is as they were')).toBeVisible();

    await user.click(asking.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(rowOf('Omar Zayed').getByText('Admin')).toBeVisible();
  });

  it('lets an admin step down, and the roster it re-reads takes the buttons away', async () => {
    const onChange = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...managesTeam([RANA, { ...OMAR, role: 'admin' }], { onChange }),
    );

    const { user } = await renderApp('/settings');
    await openActions(user, 'Rana Aljabri');
    await user.click(await screen.findByRole('menuitem', { name: 'Step down to recruiter' }));

    const asking = within(await screen.findByRole('alertdialog'));
    expect(asking.getByRole('heading', { name: 'Step down to recruiter?' })).toBeVisible();
    await user.click(asking.getByRole('button', { name: 'Step down' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(RANA.id, { role: 'recruiter' }),
    );
    expect(await screen.findByText('You are a recruiter now')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Invite teammate' })).not.toBeInTheDocument(),
    );
    expect(rowOf('Rana Aljabri').getByText('Recruiter')).toBeVisible();
  });

  it('reads a refused change from somebody who stopped being an admin mid-change', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA, OMAR]),
      ...refusesMemberChangeToNonAdmins(ADMIN_ONLY),
    );

    const { user } = await renderApp('/settings');
    await openActions(user, 'Omar Zayed');
    await user.click(await screen.findByRole('menuitem', { name: 'Make admin' }));
    await user.click(screen.getByRole('button', { name: 'Make admin' }));

    const asking = within(await screen.findByRole('alertdialog'));
    expect(await asking.findByText('Only a tenant admin can do this.')).toBeVisible();
  });

  it('forgets what was typed into an invitation that was cancelled', async () => {
    server.use(...signedInAs(RECRUITER), ...managesTeam([RANA]));

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Full name'), 'Omar Zayed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Invite teammate' }));

    expect(await screen.findByLabelText('Full name')).toHaveValue('');
  });

  it('reads a refusal aimed at somebody who stopped being an admin mid-invitation', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...refusesTeamInviteToNonAdmins(ADMIN_ONLY),
    );

    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Invite teammate' }));
    await user.type(screen.getByLabelText('Full name'), 'Omar Zayed');
    await user.type(screen.getByLabelText('Email'), 'omar@aman.test');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Only a tenant admin can do this.')).toBeVisible();
  });
});
