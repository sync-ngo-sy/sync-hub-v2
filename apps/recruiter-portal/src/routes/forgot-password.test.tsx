import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { faultsOnResetRequest, sendsResetEmail, signedOut } from '@/features/auth/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function askForALink(user: UserEvent, email = RECRUITER.email) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
}

describe('asking for a recruiter password-reset link', () => {
  it('reports success without saying whether the address has an account', async () => {
    const request = vi.fn();
    server.use(...signedOut(), ...sendsResetEmail(request));

    const { user } = await renderApp('/forgot-password');
    await askForALink(user);

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(/If an account exists for/)).toBeVisible();
    expect(screen.getByText(RECRUITER.email)).toBeVisible();
    expect(request).toHaveBeenCalledWith({ email: RECRUITER.email });
  });

  it('holds a malformed address at the form', async () => {
    server.use(...signedOut());

    const { user } = await renderApp('/forgot-password');
    await askForALink(user, 'rana');

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

  it('is reachable from sign-in', async () => {
    server.use(...signedOut());

    const { router, user } = await renderApp('/login');
    await user.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'));
    expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });
});
