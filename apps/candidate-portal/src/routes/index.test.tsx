import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  listsJobs,
  publishesNothing,
  ratelimitsJobs,
  withholdsJobs,
} from '@/features/jobs/testing/handlers';
import { HEADLINE_TEXT } from '@/features/landing/components/headline';
import { env } from '@/lib/env';
import { PUBLIC_JOBS } from '@/testing/fixtures';
import { stubMatchMedia } from '@/testing/media-query';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function prefersReducedMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    stubMatchMedia((query) => query.includes('prefers-reduced-motion')),
  );
}

describe('the candidate landing', () => {
  it('leads with the headline and sends its CTAs to browse, sign-up and the employer page', async () => {
    server.use(...listsJobs(PUBLIC_JOBS));

    await renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT }),
    ).toBeInTheDocument();

    const hero = screen.getByRole('main');
    expect(within(hero).getByRole('link', { name: 'Browse jobs' })).toHaveAttribute(
      'href',
      '/jobs',
    );
    expect(within(hero).getByRole('link', { name: 'Create your profile' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(within(hero).getByRole('link', { name: 'See Sync for employers' })).toHaveAttribute(
      'href',
      env.recruiterPortalUrl,
    );
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'For employers' }),
    ).toHaveAttribute('href', env.recruiterPortalUrl);
  });

  it('holds the site links and sign-up behind the menu button a phone header shows', async () => {
    server.use(...listsJobs(PUBLIC_JOBS));

    const { user } = await renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('link', { name: 'Browse jobs' })).toHaveAttribute(
      'href',
      '/jobs',
    );
    expect(within(menu).getByRole('link', { name: 'For employers' })).toHaveAttribute(
      'href',
      env.recruiterPortalUrl,
    );
    expect(within(menu).getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('shows the newest published jobs, each linking to its own page', async () => {
    server.use(...listsJobs(PUBLIC_JOBS));

    await renderApp('/');

    const index = await screen.findByRole('list', { name: 'Newest roles' });

    // Newest first, as the API orders them, each row leading to that Job.
    expect(
      within(index)
        .getAllByRole('link')
        .map((row) => row.getAttribute('href')),
    ).toEqual(PUBLIC_JOBS.map((job) => `/jobs/${job.id}`));

    const developer = within(index).getByRole('link', { name: /Frontend Developer/ });
    expect(
      within(developer).getByText('Levant Digital · Damascus · Remote · Full time'),
    ).toBeVisible();
    // Neither location nor employment type: the meta line carries only what the Job has.
    const pharmacist = within(index).getByRole('link', { name: /Pharmacist/ });
    expect(within(pharmacist).getByText('Sham Care')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse all jobs' })).toHaveAttribute('href', '/jobs');
  });

  it('holds the index open with a skeleton while the newest jobs load', async () => {
    server.use(...withholdsJobs());

    await renderApp('/');

    expect(screen.getByRole('status', { name: 'Loading the newest roles' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Newest roles' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeInTheDocument();
  });

  it('invites a visitor to be ready when nothing is published yet', async () => {
    server.use(...publishesNothing());

    await renderApp('/');

    const openRoles = await screen.findByRole('region', { name: 'Open roles' });

    expect(within(openRoles).getByText(/No roles are open right now/)).toBeVisible();
    expect(within(openRoles).getByRole('link', { name: 'Create your profile' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.queryByRole('list', { name: 'Newest roles' })).toBeNull();
  });

  it('offers a retry when the newest jobs cannot be loaded, and keeps the rest of the page', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(...ratelimitsJobs());

    const { user } = await renderApp('/');

    expect(await screen.findByText("Couldn't load the newest roles.")).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open roles' })).toBeVisible();
    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Newest roles]',
      expect.objectContaining({ status: 429 }),
    );

    server.use(...listsJobs(PUBLIC_JOBS));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('list', { name: 'Newest roles' })).toBeVisible();
  });

  it('collapses the typewriter to static text for a reader who asked for less motion', async () => {
    prefersReducedMotion();
    server.use(...listsJobs(PUBLIC_JOBS));

    await renderApp('/');

    const headline = await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT });
    // The animated headline carries the sentence twice — once for assistive tech, once as the
    // characters it reveals. Static text carries it exactly once, with nothing hidden.
    expect(headline.textContent).toBe(HEADLINE_TEXT);
    expect(headline.querySelector('[style*="hidden"]')).toBeNull();
  });
});
