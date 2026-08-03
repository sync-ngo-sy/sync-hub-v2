import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { ARABIC, OPEN_TO_RELOCATION } from '@/features/crm/testing/fixtures';
import { listsVocabulary } from '@/features/crm/testing/handlers';
import { OMAR, RANA } from '@/features/team/testing/fixtures';
import { failsToListMembers, listsMembers } from '@/features/team/testing/handlers';
import { belongsToTenant } from '@/features/tenant/testing/handlers';
import { AMAN, RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function rowOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(name) }));
}

describe('Workspace settings', () => {
  it('opens on the team, and offers the Tags and the Tenant beside it', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([RANA, OMAR]));

    await renderApp('/settings');

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const tabs = within(screen.getByRole('tablist', { name: 'Workspace settings' }));
    expect(tabs.getByRole('tab', { name: 'Team' })).toHaveAttribute('aria-selected', 'true');
    expect(tabs.getByRole('tab', { name: 'Tags' })).toBeVisible();
    expect(tabs.getByRole('tab', { name: 'Tenant' })).toBeVisible();
    expect(await screen.findByText('Omar Zayed')).toBeVisible();
  });

  it('keeps the tab in the address bar, so a reload and a pasted link land on the same one', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...listsVocabulary([ARABIC, OPEN_TO_RELOCATION]),
    );

    const { user, router } = await renderApp('/settings?tab=tags');

    expect(await screen.findByText('Arabic')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Tenant' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'tenant' }));
  });

  it('reads the Tenant as its own Recruiters see it, and says whose it is to change', async () => {
    server.use(...signedInAs(RECRUITER), ...belongsToTenant(AMAN), ...listsMembers([RANA]));

    await renderApp('/settings?tab=tenant');

    expect(await screen.findByText('Aman Relief')).toBeVisible();
    expect(screen.getByText('aman-relief')).toBeVisible();
    expect(
      screen.getByText(
        'Sync opened your Tenant and keeps its name and address. Ask us to change either.',
      ),
    ).toBeVisible();
  });

  it('shows a Recruiter the roster, without the moves that are an admin’s to make', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([{ ...RANA, role: 'recruiter' }, OMAR]));

    await renderApp('/settings');

    expect(await screen.findByText('Omar Zayed')).toBeVisible();
    expect(
      screen.getByText(
        'Only an admin can invite a teammate or change what a colleague may do. Ask one of yours.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Invite teammate' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Actions for Omar Zayed' }),
    ).not.toBeInTheDocument();
  });

  it('tells you which row is yours, and offers no change to your own access', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([RANA, OMAR]));

    await renderApp('/settings');

    expect(await screen.findByText('Omar Zayed')).toBeVisible();
    expect(rowOf('Rana Aljabri').getByText('You')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Actions for Rana Aljabri' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Omar Zayed' })).toBeVisible();
  });

  it('keeps the page when the roster will not load, and offers its own Retry', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToListMembers(SERVER_FAULT));

    await renderApp('/settings');

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Tags' })).toBeVisible();
  });
});
