import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentProfileQuery } from '@/features/auth/current-profile';
import {
  confirmsEmail,
  faultsOnConfirmation,
  refusesConfirmation,
  refusesConfirmationShape,
  signedOut,
} from '@/features/auth/testing/handlers';
import { CANDIDATE, DEAD_LINK, MALFORMED_REQUEST, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const CONFIRM_LINK = '/auth/confirm?token_hash=emailed-token&type=signup';

describe('confirming an email address', () => {
  it('redeems the token and arrives signed in on My Applications', async () => {
    server.use(...signedOut(), ...confirmsEmail(CANDIDATE));

    const { router, queryClient } = await renderApp(CONFIRM_LINK);

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(await screen.findByRole('heading', { name: 'My Applications' })).toBeVisible();
    expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toEqual(CANDIDATE);
  });

  it('offers a way forward when the link is spent or expired', async () => {
    server.use(...signedOut(), ...refusesConfirmation(DEAD_LINK));

    const { router } = await renderApp(CONFIRM_LINK);

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/auth/confirm');
  });

  it('treats a link with no token as a dead link rather than a crash', async () => {
    server.use(...signedOut());

    await renderApp('/auth/confirm');

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
  });

  it('offers a retry when the server faults, rather than blaming the link', async () => {
    server.use(...signedOut(), ...faultsOnConfirmation(SERVER_FAULT));

    await renderApp(CONFIRM_LINK);

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: "This link didn't work" }),
    ).not.toBeInTheDocument();
  });

  it('only calls the link dead when the API says the token is', async () => {
    server.use(...signedOut(), ...refusesConfirmationShape(MALFORMED_REQUEST));

    await renderApp(CONFIRM_LINK);

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: "This link didn't work" }),
    ).not.toBeInTheDocument();
  });
});
