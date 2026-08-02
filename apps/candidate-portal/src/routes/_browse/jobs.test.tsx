import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import {
  listsJobs,
  pagesJobs,
  publishesNothing,
  ratelimitsJobs,
  withholdsJobs,
} from '@/features/jobs/testing/handlers';
import { CANDIDATE, MORE_PUBLIC_JOBS, PUBLIC_JOBS, TOO_MANY_REQUESTS } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('browsing jobs', () => {
  it('lists the published jobs newest-first, each row leading to that Job', async () => {
    server.use(...signedOut(), ...listsJobs(PUBLIC_JOBS));

    await renderApp('/jobs');

    const list = await screen.findByRole('list', { name: 'Jobs' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((row) => row.getAttribute('href')),
    ).toEqual(PUBLIC_JOBS.map((job) => `/jobs/${job.id}`));

    const developer = within(list).getByRole('link', { name: /Frontend Developer/ });
    expect(within(developer).getByText('Levant Digital · Damascus · Full-time')).toBeVisible();
    // Neither location nor employment type: the meta line carries only what the Job has.
    const pharmacist = within(list).getByRole('link', { name: /Pharmacist/ });
    expect(within(pharmacist).getByText('Sham Care')).toBeVisible();
  });

  it('appends the next page on demand, and stops offering one at the end of the list', async () => {
    server.use(...signedOut(), ...pagesJobs([PUBLIC_JOBS, MORE_PUBLIC_JOBS]));

    const { user } = await renderApp('/jobs');

    const list = await screen.findByRole('list', { name: 'Jobs' });
    expect(within(list).getAllByRole('link')).toHaveLength(PUBLIC_JOBS.length);

    await user.click(screen.getByRole('button', { name: 'Load more jobs' }));

    await waitFor(() =>
      expect(within(list).getByRole('link', { name: /Logistics Officer/ })).toBeVisible(),
    );
    // Appended, not replaced: the first page is still above the one just fetched.
    expect(within(list).getAllByRole('link')).toHaveLength(
      PUBLIC_JOBS.length + MORE_PUBLIC_JOBS.length,
    );
    expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull();
  });

  it('holds the page open with a skeleton list while the first page loads', async () => {
    server.use(...signedOut(), ...withholdsJobs());

    await renderApp('/jobs');

    expect(screen.getByRole('status', { name: 'Loading jobs' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Jobs' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  });

  it('invites a visitor to be ready when nothing is published yet', async () => {
    server.use(...signedOut(), ...publishesNothing());

    await renderApp('/jobs');

    expect(await screen.findByText(/No roles are open right now/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create your profile' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.queryByRole('list', { name: 'Jobs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull();
  });

  it('sends a signed-in candidate to their CVs when nothing is published yet', async () => {
    server.use(...signedInAs(CANDIDATE), ...publishesNothing());

    await renderApp('/jobs');

    expect(await screen.findByRole('link', { name: 'Keep your CV ready' })).toHaveAttribute(
      'href',
      '/cvs',
    );
    expect(screen.queryByRole('link', { name: 'Create your profile' })).toBeNull();
  });

  it('offers a retry when the jobs cannot be loaded, and keeps the page around it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(...signedOut(), ...ratelimitsJobs());

    const { user } = await renderApp('/jobs');

    expect(await screen.findByText("Couldn't load the jobs")).toBeVisible();
    expect(screen.getByText(TOO_MANY_REQUESTS.detail as string)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeVisible();
    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Jobs]',
      expect.objectContaining({ status: 429 }),
    );

    server.use(...listsJobs(PUBLIC_JOBS));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('list', { name: 'Jobs' })).toBeVisible();
    expect(screen.queryByText("Couldn't load the jobs")).toBeNull();
  });
});
