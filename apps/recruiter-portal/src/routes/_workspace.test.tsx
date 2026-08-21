import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { signedInAs, signedInUntilLogOut, signedOut } from '@/features/auth/testing/handlers';
import { HEADLINE_TEXT } from '@/features/landing/headline';
import { ACCESS_TURNED_OFF, TENANT_SUSPENDED } from '@/features/tenant/testing/fixtures';
import { refusesTenantAccess } from '@/features/tenant/testing/handlers';
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
    expect(screen.getByText(/Sync Hub Candidate Portal/)).toBeVisible();
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
    expect(screen.getByRole('link', { name: 'Go to Admin Portal' })).toHaveAttribute(
      'href',
      'http://localhost:5175',
    );
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

describe('a workspace the API refuses', () => {
  it('answers a recruiter whose access an admin turned off with one full-page screen', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesTenantAccess(ACCESS_TURNED_OFF));

    const { router } = await renderApp('/jobs');

    expect(router.state.location.pathname).toBe('/access-refused');
    expect(
      await screen.findByRole('heading', { name: 'You cannot open this workspace' }),
    ).toBeVisible();
    expect(screen.getByText(/An admin turned off your access/)).toBeVisible();
    expect(screen.getByText(/your Tenant’s admins/)).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).not.toBeInTheDocument();
  });

  it('answers a suspended tenant with the same screen, in words that fit it', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesTenantAccess(TENANT_SUSPENDED));

    const { router } = await renderApp('/dashboard');

    expect(router.state.location.pathname).toBe('/access-refused');
    expect(
      await screen.findByRole('heading', { name: 'You cannot open this workspace' }),
    ).toBeVisible();
    expect(screen.getByText(/suspended this Tenant/)).toBeVisible();
    expect(screen.getByText(/your Tenant’s admins/)).toBeVisible();
    expect(screen.queryByText(/An admin turned off your access/)).not.toBeInTheDocument();
  });

  it('flips a recruiter turned off mid-session onto the screen, wherever they stand', async () => {
    server.use(...signedInAs(RECRUITER));
    const { router } = await renderApp('/jobs');

    server.use(...refusesTenantAccess(ACCESS_TURNED_OFF));
    await client.GET('/v1/tenants/me');

    await waitFor(() => expect(router.state.location.pathname).toBe('/access-refused'));
    expect(
      await screen.findByRole('heading', { name: 'You cannot open this workspace' }),
    ).toBeVisible();
  });

  it('asks the API again on arrival rather than trusting a tenant reading it holds', async () => {
    server.use(...signedInAs(RECRUITER));
    const { router, user } = await renderApp('/jobs');

    server.use(...refusesTenantAccess(TENANT_SUSPENDED));
    await user.click(screen.getByRole('link', { name: 'Templates' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/access-refused'));
    expect(await screen.findByText(/suspended this Tenant/)).toBeVisible();
  });

  it('leaves the session alone rather than signing the recruiter out', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesTenantAccess(ACCESS_TURNED_OFF));

    const { router, queryClient } = await renderApp('/jobs');

    expect(await screen.findByText(/still signed in/)).toBeVisible();
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toEqual(RECRUITER);
    expect(router.state.location.pathname).toBe('/access-refused');
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
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

  it('points the logo at the dashboard, never back out to the landing page', async () => {
    server.use(...signedInAs(RECRUITER));

    await renderApp('/talent-pool');

    for (const logo of screen.getAllByRole('link', { name: 'Sync Hub' })) {
      expect(logo).toHaveAttribute('href', '/dashboard');
    }
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
    server.use(...signedInUntilLogOut(RECRUITER));
    const { router, queryClient, user } = await renderApp('/dashboard');

    await user.click(screen.getByRole('button', { name: `Account: ${RECRUITER.full_name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeVisible();
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
