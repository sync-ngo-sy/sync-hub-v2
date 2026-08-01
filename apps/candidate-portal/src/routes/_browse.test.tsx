import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { client } from '@/lib/api';
import { CANDIDATE, RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('browsing jobs', () => {
  it('is open to a visitor with no session, who is offered a way in', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/jobs');

    expect(router.state.location.pathname).toBe('/jobs');
    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });

  it('carries the full chrome once the candidate is signed in', async () => {
    server.use(...signedInAs(CANDIDATE));

    await renderApp('/jobs');

    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: `Account: ${CANDIDATE.full_name}` }),
    ).toBeInTheDocument();
  });

  it('tells a signed-in recruiter they are in the wrong portal', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/jobs');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });

  it('keeps a reader on the page when their session dies, but forgets the account', async () => {
    server.use(...signedInAs(CANDIDATE));
    const { router, queryClient } = await renderApp('/jobs');

    server.use(...signedOut());
    await client.GET('/v1/auth/me');

    await waitFor(() =>
      expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toBeUndefined(),
    );
    expect(router.state.location.pathname).toBe('/jobs');
  });
});
