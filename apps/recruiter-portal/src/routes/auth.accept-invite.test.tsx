import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { acceptsInvite, faultsOnInvite, refusesInvite } from '@/features/auth/testing/handlers';
import { DEAD_LINK, RECRUITER, SERVER_FAULT, WEAK_PASSWORD } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const INVITE_LINK = '/auth/accept-invite?token_hash=emailed-token&type=invite';

async function chooseAPassword(user: UserEvent, password = 'CorrectHorse9') {
  await user.type(screen.getByLabelText('Choose a password'), password);
  await user.click(screen.getByRole('button', { name: 'Join workspace' }));
}

describe('accepting a teammate invitation', () => {
  it('sets the password and arrives signed in on the Dashboard', async () => {
    const request = vi.fn();
    server.use(...acceptsInvite(RECRUITER, request));

    const { router, queryClient, user } = await renderApp(INVITE_LINK);
    await chooseAPassword(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toEqual(RECRUITER);
    expect(request).toHaveBeenCalledWith({
      token_hash: 'emailed-token',
      password: 'CorrectHorse9',
    });
  });

  it('explains how to recover from a spent, expired, or missing invitation', async () => {
    server.use(...refusesInvite(DEAD_LINK));

    const { user } = await renderApp(INVITE_LINK);
    await chooseAPassword(user);

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
    expect(screen.getByText(/Ask your workspace admin for a new invitation/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
  });

  it('treats a missing token as a dead link immediately', async () => {
    await renderApp('/auth/accept-invite');

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
  });

  it('keeps a refused password beside the field', async () => {
    server.use(...refusesInvite(WEAK_PASSWORD));

    const { user } = await renderApp(INVITE_LINK);
    await chooseAPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(WEAK_PASSWORD.detail ?? '');
    expect(screen.getByLabelText('Choose a password')).toHaveAttribute('aria-invalid');
  });

  it('sends a server fault to a toast and keeps the invitation usable', async () => {
    server.use(...faultsOnInvite(SERVER_FAULT));

    const { router, user } = await renderApp(INVITE_LINK);
    await chooseAPassword(user);

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByLabelText('Choose a password')).not.toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/auth/accept-invite');
  });
});
