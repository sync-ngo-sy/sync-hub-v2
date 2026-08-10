import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { acceptsAccessRequest, refusesAccessRequest } from '@/features/access/testing/handlers';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { CANDIDATE, RECRUITER, TOO_MANY_REQUESTS } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const ASK = { company: 'Aman Relief', full_name: 'Rana Aljabri', email: 'rana@aman.test' };

async function askForAccess(user: UserEvent) {
  await user.type(screen.getByLabelText('Company'), ASK.company);
  await user.type(screen.getByLabelText('Your name'), ASK.full_name);
  await user.type(screen.getByLabelText('Work email'), ASK.email);
  await user.click(screen.getByRole('button', { name: 'Request access' }));
}

describe('asking for access to Sync Hub', () => {
  it('sends the company, the name and the address, and says the request was received', async () => {
    const request = vi.fn();
    server.use(...signedOut(), ...acceptsAccessRequest(request));

    const { user } = await renderApp('/request-access');
    await askForAccess(user);

    expect(await screen.findByRole('heading', { name: 'Request received' })).toBeVisible();
    expect(request).toHaveBeenCalledWith(ASK);
  });

  it('validates every required value before asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...acceptsAccessRequest(unexpected));

    const { user } = await renderApp('/request-access');
    await user.click(screen.getByRole('button', { name: 'Request access' }));

    expect(await screen.findByText('Enter your company name.')).toBeVisible();
    expect(screen.getByText('Enter your name.')).toBeVisible();
    expect(screen.getByText('Enter your email.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it('keeps the form and says so when the API turns the request away', async () => {
    server.use(...signedOut(), ...refusesAccessRequest(TOO_MANY_REQUESTS));

    const { user } = await renderApp('/request-access');
    await askForAccess(user);

    expect(await screen.findByText(TOO_MANY_REQUESTS.detail ?? '')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Request access to Sync Hub' })).toBeVisible();
  });

  it('leads a visitor who still remembers the old sign-up address here', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/signup');

    await waitFor(() => expect(router.state.location.pathname).toBe('/request-access'));
    expect(
      await screen.findByRole('heading', { name: 'Request access to Sync Hub' }),
    ).toBeVisible();
  });

  it('bounces a signed-in recruiter to the Dashboard', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/request-access');

    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('sends a signed-in candidate to the Wrong-portal screen', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/request-access');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });
});
