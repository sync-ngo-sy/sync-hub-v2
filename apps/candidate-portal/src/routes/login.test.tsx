import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  faultsOnSignIn,
  logsIn,
  rejectsCredentials,
  signedInAs,
  signedOut,
} from '@/features/auth/testing/handlers';
import { CANDIDATE, RECRUITER, SERVER_FAULT, WRONG_PASSWORD } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function signIn(user: UserEvent) {
  await user.type(screen.getByLabelText('Email'), CANDIDATE.email);
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('signing in', () => {
  it('lands the candidate where the guard turned them away from', async () => {
    server.use(...signedOut(), ...logsIn(CANDIDATE));

    const { router, user } = await renderApp('/login?returnTo=%2Fcvs');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/cvs'));
    expect(await screen.findByRole('heading', { name: 'CVs' })).toBeVisible();
  });

  it('sends a candidate with no destination to My Applications', async () => {
    server.use(...signedOut(), ...logsIn(CANDIDATE));

    const { router, user } = await renderApp('/login');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(await screen.findByRole('heading', { name: 'My Applications' })).toBeVisible();
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

  it('sends a server fault to a toast, not to the password field', async () => {
    server.use(...signedOut(), ...faultsOnSignIn(SERVER_FAULT));

    const { router, user } = await renderApp('/login');
    await signIn(user);

    const toast = await screen.findByText('Something went wrong on our side.');
    expect(toast).toBeVisible();
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('ignores an off-site returnTo rather than following it', async () => {
    server.use(...signedOut(), ...logsIn(CANDIDATE));

    const { router, user } = await renderApp('/login?returnTo=https%3A%2F%2Fevil.test%2Fsteal');
    await signIn(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
  });

  it('bounces a candidate who is already signed in off the sign-in page', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/login');

    expect(router.state.location.pathname).toBe('/applications');
    expect(await screen.findByRole('heading', { name: 'My Applications' })).toBeVisible();
  });

  it('honours the returnTo when bouncing an already-signed-in candidate', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/login?returnTo=%2Fprofile');

    expect(router.state.location.pathname).toBe('/profile');
  });

  it('sends a signed-in recruiter to the Wrong-portal screen, not the sign-in form', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/login');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });
});
