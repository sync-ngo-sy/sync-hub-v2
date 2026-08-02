import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { CANDIDATE, PLATFORM_ADMIN, RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('the admin access guard', () => {
  it('sends an anonymous visitor to sign in while remembering the requested destination', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/tenants');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ returnTo: '/tenants' });
  });

  it('shows the guarded overview to a platform admin', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN));

    const { router } = await renderApp('/overview');

    expect(router.state.location.pathname).toBe('/overview');
    expect(await screen.findByRole('heading', { name: 'Platform overview' })).toBeVisible();
  });

  it('sends a candidate to the wrong-portal screen', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/overview');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Sync Platform Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/candidate account/)).toBeVisible();
  });

  it('sends a recruiter to the wrong-portal screen', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/tenants');

    expect(router.state.location.pathname).toBe('/wrong-portal');
    expect(
      await screen.findByRole('heading', { name: 'This is the Sync Platform Portal' }),
    ).toBeVisible();
    expect(screen.getByText(/recruiter account/)).toBeVisible();
  });

  it('returns a platform admin to sign in when the session expires in the shell', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN));
    const { queryClient, router } = await renderApp('/overview');

    server.use(...signedOut());
    await expect(
      queryClient.fetchQuery({ ...currentProfileQuery, staleTime: 0 }),
    ).rejects.toBeDefined();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/overview' });
  });
});
