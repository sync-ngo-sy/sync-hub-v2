import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  logsIn,
  rejectsCredentials,
  signedInAs,
  signedOut,
} from '@/features/auth/testing/handlers';
import { CANDIDATE, RECRUITER, WRONG_PASSWORD } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function signIn(user: UserEvent) {
  await user.type(screen.getByLabelText('Email'), RECRUITER.email);
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('signing in', () => {
  it('lands the recruiter where the guard turned them away from', async () => {
    server.use(...signedOut(), ...logsIn(RECRUITER));

    const { router, user } = await renderApp('/login?returnTo=%2Fjobs');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));
    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeVisible();
  });

  it('offers newcomers a way to ask for access, never a workspace to create', async () => {
    server.use(...signedOut());

    await renderApp('/login');

    expect(await screen.findByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/request-access',
    );
    expect(screen.queryByRole('link', { name: /workspace/i })).not.toBeInTheDocument();
  });

  it('sends a recruiter with no destination to the Dashboard', async () => {
    server.use(...signedOut(), ...logsIn(RECRUITER));

    const { router, user } = await renderApp('/login');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('says what went wrong beside the fields, and stays put', async () => {
    server.use(...signedOut(), ...rejectsCredentials(WRONG_PASSWORD));

    const { router, user } = await renderApp('/login');
    await signIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password do not match an account.',
    );
    expect(router.state.location.pathname).toBe('/login');
  });

  it('ignores an off-site returnTo rather than following it', async () => {
    server.use(...signedOut(), ...logsIn(RECRUITER));

    const { router, user } = await renderApp('/login?returnTo=https%3A%2F%2Fevil.test%2Fsteal');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('bounces a recruiter who is already signed in off the sign-in page', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/login');

    expect(router.state.location.pathname).toBe('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('honours the returnTo when bouncing an already-signed-in recruiter', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/login?returnTo=%2Ftemplates');

    expect(router.state.location.pathname).toBe('/templates');
  });

  it('sends a signed-in candidate to the Wrong-portal screen, not the sign-in form', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/login');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });
});
