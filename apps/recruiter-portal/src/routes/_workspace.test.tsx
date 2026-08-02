import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { logsOut, signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { HEADLINE_TEXT } from '@/features/landing/headline';
import { client } from '@/lib/api';
import { CANDIDATE, PLATFORM_ADMIN, RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('the workspace guard', () => {
  it('sends an anonymous visitor to sign in, remembering where they were headed', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/jobs');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ returnTo: '/jobs' });
  });

  it('shows a candidate account the Wrong-portal screen instead of the workspace', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/dashboard');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Recruiter Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/Sync Candidate Portal/)).toBeVisible();
  });

  it('shows a platform admin the same notice, in words that fit their account', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN));

    const { router } = await renderApp('/dashboard');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Recruiter Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/platform admin account/)).toBeVisible();
    expect(screen.queryByText(/candidate account/)).not.toBeInTheDocument();
  });

  it('redirects to sign in when the client reports the session is over', async () => {
    server.use(...signedInAs(RECRUITER));
    const { router } = await renderApp('/jobs');

    server.use(...signedOut());
    await client.GET('/v1/auth/me');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/jobs' });
  });
});

describe('the workspace chrome', () => {
  it('marks the destination the recruiter is on', async () => {
    server.use(...signedInAs(RECRUITER));

    await renderApp('/talent-pool');

    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(nav).getByRole('link', { name: 'Talent pool' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Jobs' })).not.toHaveAttribute('aria-current');
  });

  it('offers the same navigation in a drawer, which closes on arrival', async () => {
    server.use(...signedInAs(RECRUITER));
    const { router, user } = await renderApp('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('link', { name: 'Templates' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('signs the recruiter out, landing on the landing page with an empty cache', async () => {
    server.use(...signedInAs(RECRUITER), ...logsOut());
    const { router, queryClient, user } = await renderApp('/dashboard');

    await user.click(screen.getByRole('button', { name: `Account: ${RECRUITER.full_name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeVisible();
    // The cache is emptied once the landing has actually taken over, a chunk-load after the
    // address changes.
    await waitFor(() =>
      expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toBeUndefined(),
    );
  });
});

describe('an address that does not exist', () => {
  it('gets a designed not-found page rather than a blank screen', async () => {
    server.use(...signedInAs(RECRUITER));

    await renderApp('/nowhere');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
