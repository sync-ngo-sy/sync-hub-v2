import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { logsOutOf, signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import { HEADLINE_TEXT } from '@/features/landing/components/headline';
import { hasProfile } from '@/features/profile/testing/handlers';
import { client } from '@/lib/api';
import {
  CANDIDATE,
  CANDIDATE_PROFILE,
  PLATFORM_ADMIN,
  PUBLIC_JOBS,
  RECRUITER,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('the account guard', () => {
  it('sends an anonymous visitor to sign in, remembering where they were headed', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/applications');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ returnTo: '/applications' });
  });

  it('shows a recruiter account the Wrong-portal screen instead of the account area', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/cvs');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Candidate Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/Sync Hub\s+Recruiter Portal/)).toBeVisible();
  });

  it('shows a platform admin the same notice, in words that fit their account', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN));

    const { router } = await renderApp('/cvs');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Candidate Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/platform admin account/)).toBeVisible();
    expect(screen.queryByText(/Sync Hub\s+Recruiter Portal/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Admin Portal' })).toHaveAttribute(
      'href',
      'http://localhost:5175',
    );
  });

  it('redirects to sign in when the client reports the session is over', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    const { router } = await renderApp('/profile');

    server.use(...signedOut());
    await client.GET('/v1/auth/me');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/profile' });
  });
});

describe('the account chrome', () => {
  it('marks the destination the candidate is on', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));

    await renderApp('/profile');

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Jobs' })).not.toHaveAttribute('aria-current');
  });

  it('offers no CVs tab, because there is no page to send it to', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));

    await renderApp('/profile');

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).queryByRole('link', { name: 'CVs' })).toBeNull();
  });

  it('points the logo at the applications list, never back out to the landing page', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));

    await renderApp('/profile');

    expect(screen.getByRole('link', { name: 'Sync Hub' })).toHaveAttribute('href', '/applications');
  });

  it('moves between destinations from the tab bar', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    const { router, user } = await renderApp('/applications');

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    await user.click(within(nav).getByRole('link', { name: 'Profile' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('keeps Notifications and Account settings in the account menu', async () => {
    server.use(...signedInAs(CANDIDATE));
    const { router, user } = await renderApp('/applications');

    await user.click(screen.getByRole('button', { name: `Account: ${CANDIDATE.full_name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Notifications' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/notifications'));
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeVisible();
  });

  it('signs the candidate out, landing on the landing page with an empty cache', async () => {
    server.use(...logsOutOf(CANDIDATE), ...listsJobs(PUBLIC_JOBS));
    const { router, queryClient, user } = await renderApp('/applications');

    await user.click(screen.getByRole('button', { name: `Account: ${CANDIDATE.full_name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeVisible();
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toBeUndefined();
  });
});

describe('an address that does not exist', () => {
  it('gets a designed not-found page rather than a blank screen', async () => {
    server.use(...signedInAs(CANDIDATE));

    await renderApp('/nowhere');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
