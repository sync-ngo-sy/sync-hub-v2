import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { ACCESS_TURNED_OFF } from '@/features/tenant/testing/fixtures';
import { refusesTenantAccess } from '@/features/tenant/testing/handlers';
import { CANDIDATE, RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('the address of the refusal', () => {
  it('asks the API again and shows the screen while the refusal stands', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesTenantAccess(ACCESS_TURNED_OFF));

    const { router } = await renderApp('/access-refused');

    expect(router.state.location.pathname).toBe('/access-refused');
    expect(
      await screen.findByRole('heading', { name: 'You cannot open this workspace' }),
    ).toBeVisible();
  });

  it('opens the workspace instead once the API serves the recruiter again', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/access-refused');

    expect(router.state.location.pathname).toBe('/dashboard');
    expect(
      screen.queryByRole('heading', { name: 'You cannot open this workspace' }),
    ).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/access-refused');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('sends an account this portal does not serve to the Wrong-portal screen', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/access-refused');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });
});
