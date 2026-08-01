import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import {
  confirmsEmail,
  faultsOnConfirmation,
  refusesConfirmation,
  signedOut,
} from '@/features/auth/testing/handlers';
import { DEAD_LINK, RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const CONFIRM_LINK = '/auth/confirm?token_hash=emailed-token&type=signup';

describe('confirming a founding admin email', () => {
  it('redeems the token and arrives signed in on the Dashboard', async () => {
    const request = vi.fn();
    server.use(...signedOut(), ...confirmsEmail(RECRUITER, request));

    const { router, queryClient } = await renderApp(CONFIRM_LINK);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toEqual(RECRUITER);
    expect(request).toHaveBeenCalledWith({ token_hash: 'emailed-token' });
  });

  it('offers sign-in when the link is spent, expired, or missing', async () => {
    server.use(...signedOut(), ...refusesConfirmation(DEAD_LINK));

    await renderApp(CONFIRM_LINK);

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeVisible();

    await renderApp('/auth/confirm');
    expect(await screen.findAllByRole('heading', { name: "This link didn't work" })).toHaveLength(
      2,
    );
  });

  it('offers a retry when the server faults instead of blaming the link', async () => {
    server.use(...signedOut(), ...faultsOnConfirmation(SERVER_FAULT));

    await renderApp(CONFIRM_LINK);

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
