import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { holdsSession, signedInAs } from '@/features/auth/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import { holdsProfile } from '@/features/profile/testing/handlers';
import { CANDIDATE, CANDIDATE_PROFILE, PUBLIC_JOBS } from '@/testing/fixtures';
import { startApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const ARRIVING = { timeout: 5_000 };

function bars() {
  return document.querySelectorAll('[data-slot="skeleton"]');
}

function statCells() {
  return document.querySelectorAll('[data-slot="stat"]');
}

describe('a route that is still arriving', () => {
  it('holds the account chrome open while the session is on the wire', async () => {
    const held = holdsSession(CANDIDATE);
    server.use(...held.handlers);

    startApp('/applications');

    expect(
      await screen.findByRole('status', { name: 'Loading your account' }, ARRIVING),
    ).toBeInTheDocument();
    expect(bars().length).toBeGreaterThan(0);

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'My Applications' })).toBeVisible();
  });

  it('stands the jobs list up as a list, with no stat cards it does not have', async () => {
    const held = holdsSession(CANDIDATE);
    server.use(...held.handlers, ...listsJobs(PUBLIC_JOBS));

    startApp('/jobs');

    const arriving = await screen.findByRole('status', { name: 'Loading Sync Hub' }, ARRIVING);

    expect(statCells()).toHaveLength(0);
    expect(within(arriving).queryByRole('list')).toBeNull();
    expect(within(arriving).queryByRole('heading')).toBeNull();

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeVisible();
  });

  it('stands the profile page up in its own shape while the profile loads', async () => {
    const held = holdsProfile(CANDIDATE_PROFILE);
    server.use(...signedInAs(CANDIDATE), ...held.handlers);

    startApp('/profile');

    expect(
      await screen.findByRole('status', { name: 'Loading your profile' }, ARRIVING),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading your account' })).toBeNull();

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });
});
