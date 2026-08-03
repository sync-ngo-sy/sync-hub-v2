import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  faultsOnReset,
  refusesReset,
  resetsPassword,
  signedOut,
} from '@/features/auth/testing/handlers';
import { DEAD_LINK, SERVER_FAULT, WEAK_PASSWORD } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const RESET_LINK = '/auth/reset-password?token_hash=emailed-token&type=recovery';

async function chooseAPassword(user: UserEvent, password = 'correct-horse-battery') {
  await user.type(screen.getByLabelText('New password'), password);
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
}

describe('choosing a new recruiter password', () => {
  it('saves it and hands the recruiter to sign-in', async () => {
    const request = vi.fn();
    server.use(...signedOut(), ...resetsPassword(request));

    const { router, user } = await renderApp(RESET_LINK);
    await chooseAPassword(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(
      await screen.findByText('Password updated. Sign in with your new password.'),
    ).toBeVisible();
    expect(request).toHaveBeenCalledWith({
      token_hash: 'emailed-token',
      password: 'correct-horse-battery',
    });
  });

  it('offers a fresh link when this one is spent or expired', async () => {
    server.use(...signedOut(), ...refusesReset(DEAD_LINK));

    const { user } = await renderApp(RESET_LINK);
    await chooseAPassword(user);

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toBeVisible();
  });

  it('treats a missing token as a dead link immediately', async () => {
    server.use(...signedOut());

    await renderApp('/auth/reset-password');

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
  });

  it('keeps a refused password beside the field', async () => {
    server.use(...signedOut(), ...refusesReset(WEAK_PASSWORD));

    const { user } = await renderApp(RESET_LINK);
    await chooseAPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(WEAK_PASSWORD.detail ?? '');
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid');
  });

  it('sends a server fault to a toast and keeps the link usable', async () => {
    server.use(...signedOut(), ...faultsOnReset(SERVER_FAULT));

    const { router, user } = await renderApp(RESET_LINK);
    await chooseAPassword(user);

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(router.state.location.pathname).toBe('/auth/reset-password');
  });
});
