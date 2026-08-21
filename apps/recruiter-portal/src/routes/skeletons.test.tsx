import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { holdsSession, signedInAs } from '@/features/auth/testing/handlers';
import { STAT_LABELS } from '@/features/dashboard/dashboard';
import { A_BUSY_WEEK } from '@/features/dashboard/testing/fixtures';
import { servesStats } from '@/features/dashboard/testing/handlers';
import { FIELD_COORDINATOR, FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { holdsJob, holdsJobs } from '@/features/jobs/testing/handlers';
import { holdsLocations } from '@/features/reference/testing/handlers';
import { CANDIDATE, LOCATIONS, RECRUITER } from '@/testing/fixtures';
import { startApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const ARRIVING = { timeout: 5_000 };

function bars() {
  return document.querySelectorAll('[data-slot="skeleton"]');
}

function statCells() {
  return document.querySelectorAll('[data-slot="stat"]');
}

describe('a public route that is still arriving', () => {
  it('stands the sign-in screen up as a form while the session is checked', async () => {
    const held = holdsSession(CANDIDATE);
    server.use(...held.handlers);

    startApp('/login');

    expect(await screen.findByRole('status', { name: 'Loading' }, ARRIVING)).toBeInTheDocument();
    expect(bars().length).toBeGreaterThan(0);

    held.arrive();

    expect(
      await screen.findByRole('heading', { name: 'This is the Recruiter Portal' }),
    ).toBeVisible();
  });
});

describe('a workspace route that is still arriving', () => {
  it('holds the workspace chrome open while the session is on the wire', async () => {
    const held = holdsSession(RECRUITER);
    server.use(...held.handlers);

    startApp('/jobs');

    expect(
      await screen.findByRole('status', { name: 'Loading your workspace' }, ARRIVING),
    ).toBeInTheDocument();
    expect(bars().length).toBeGreaterThan(0);

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeVisible();
  });

  it('stands the Jobs list up as a list, with no stat cards it does not have', async () => {
    const held = holdsJobs([FIELD_COORDINATOR]);
    server.use(...signedInAs(RECRUITER), ...held.handlers);

    startApp('/jobs');

    expect(
      await screen.findByRole('status', { name: 'Loading Jobs' }, ARRIVING),
    ).toBeInTheDocument();
    expect(statCells()).toHaveLength(0);

    held.arrive();

    expect(await screen.findByText('Field Coordinator')).toBeVisible();
  });

  it('stands a Job up with its own facts and tabs rather than a list', async () => {
    const held = holdsJob(FIELD_COORDINATOR_VIEW);
    server.use(...signedInAs(RECRUITER), ...held.handlers);

    startApp(`/jobs/${FIELD_COORDINATOR_VIEW.id}`);

    expect(
      await screen.findByRole('status', { name: 'Loading this Job' }, ARRIVING),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading Jobs' })).toBeNull();

    held.arrive();

    expect(
      await screen.findByRole('heading', { name: FIELD_COORDINATOR_VIEW.title }),
    ).toBeVisible();
  });

  it('keeps the four counts the dashboard really has while it arrives', async () => {
    const held = holdsJobs([FIELD_COORDINATOR]);
    server.use(...signedInAs(RECRUITER), ...servesStats(A_BUSY_WEEK), ...held.handlers);

    startApp('/dashboard');

    expect(
      await screen.findByRole('status', { name: 'Loading your dashboard' }, ARRIVING),
    ).toBeInTheDocument();
    expect(statCells()).toHaveLength(STAT_LABELS.length);

    held.arrive();

    expect(await screen.findByText('78% pass rate')).toBeVisible();
  });

  it('stands the Job form up as a form while its reference data arrives', async () => {
    const held = holdsLocations(LOCATIONS);
    server.use(...signedInAs(RECRUITER), ...held.handlers);

    startApp('/jobs/new');

    expect(
      await screen.findByRole('status', { name: 'Loading the Job form' }, ARRIVING),
    ).toBeInTheDocument();
    expect(statCells()).toHaveLength(0);

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'Create a Job' })).toBeVisible();
  });

  it('says nothing but Loading, keeping every placeholder out of the reading', async () => {
    const held = holdsJobs([FIELD_COORDINATOR]);
    server.use(...signedInAs(RECRUITER), ...held.handlers);

    startApp('/jobs');

    const arriving = await screen.findByRole('status', { name: 'Loading Jobs' }, ARRIVING);

    const reading = within(arriving);

    expect(bars().length).toBeGreaterThan(0);
    expect(reading.queryByRole('table')).toBeNull();
    expect(reading.queryByRole('tab')).toBeNull();
    expect(reading.queryByRole('heading')).toBeNull();
    expect(reading.queryByRole('button')).toBeNull();

    held.arrive();
  });
});
