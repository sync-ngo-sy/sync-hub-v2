import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  faultsOnResetRequest,
  sendsResetEmail,
  signedInAs,
  signedOut,
} from '@/features/auth/testing/handlers';
import { CANDIDATE, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function askForALink(user: UserEvent, email = CANDIDATE.email) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
}

describe('asking for a password-reset link', () => {
  it('reports success without saying whether the address has an account', async () => {
    server.use(...signedOut(), ...sendsResetEmail());

    const { user } = await renderApp('/forgot-password');
    await askForALink(user);

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(/If an account exists for/)).toBeVisible();
    expect(screen.getByText(CANDIDATE.email)).toBeVisible();
  });

  it('holds a malformed address at the form', async () => {
    server.use(...signedOut());

    const { user } = await renderApp('/forgot-password');
    await askForALink(user, 'lina');

    expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });

  it('sends a server fault to a toast and keeps the form', async () => {
    server.use(...signedOut(), ...faultsOnResetRequest(SERVER_FAULT));

    const { user } = await renderApp('/forgot-password');
    await askForALink(user);

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });

  it('bounces a candidate who is already signed in', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/forgot-password');

    expect(router.state.location.pathname).toBe('/applications');
  });

  it('is reachable from the sign-in page', async () => {
    server.use(...signedOut());

    const { router, user } = await renderApp('/login');
    await user.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'));
  });
});
