import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  faultsOnSignUp,
  refusesEmail,
  refusesPassword,
  refusesSignUpShape,
  signedInAs,
  signedOut,
  signsUp,
} from '@/features/auth/testing/handlers';
import {
  CANDIDATE,
  EMAIL_TAKEN,
  MALFORMED_REQUEST,
  RECRUITER,
  SERVER_FAULT,
  WEAK_PASSWORD,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function signUp(user: UserEvent) {
  await user.type(screen.getByLabelText('Full name'), CANDIDATE.full_name);
  await user.type(screen.getByLabelText('Email'), CANDIDATE.email);
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('signing up', () => {
  it('lands on check-your-email, naming the address the link went to', async () => {
    server.use(...signedOut(), ...signsUp(CANDIDATE));

    const { router, user } = await renderApp('/signup');
    await signUp(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/check-email'));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(CANDIDATE.email)).toBeVisible();
  });

  it('does not sign the candidate in — the emailed link does that', async () => {
    server.use(...signedOut(), ...signsUp(CANDIDATE));

    const { queryClient, user } = await renderApp('/signup');
    await signUp(user);

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(queryClient.getQueryData(['get', '/v1/auth/me'])).toBeUndefined();
  });

  it('says what is missing without asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...signsUp(CANDIDATE, unexpected));

    const { router, user } = await renderApp('/signup');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your name.')).toBeVisible();
    expect(screen.getByText('Enter your email.')).toBeVisible();
    expect(screen.getByText('Use at least 8 characters.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('puts a taken email address beside the email field, and stays put', async () => {
    server.use(...signedOut(), ...refusesEmail(EMAIL_TAKEN));

    const { router, user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account already exists for this email address.',
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('puts a password the identity provider refuses beside the password field', async () => {
    server.use(...signedOut(), ...refusesPassword(WEAK_PASSWORD));

    const { user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That password does not meet the identity provider's requirements.",
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('does not blame a field for a rejection that names none', async () => {
    server.use(...signedOut(), ...refusesSignUpShape(MALFORMED_REQUEST));

    const { user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByText('The request did not match the expected shape.')).toBeVisible();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
  });

  it('sends a server fault to a toast, not to a field', async () => {
    server.use(...signedOut(), ...faultsOnSignUp(SERVER_FAULT));

    const { router, user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('bounces a candidate who is already signed in', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/signup');

    expect(router.state.location.pathname).toBe('/applications');
  });

  it('sends a signed-in recruiter to the Wrong-portal screen, not the form', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/signup');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });

  it('bounces a signed-in candidate off check-your-email too', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/check-email');

    expect(router.state.location.pathname).toBe('/applications');
  });

  it('offers the way back to signing in', async () => {
    server.use(...signedOut());

    const { router, user } = await renderApp('/signup');
    await user.click(screen.getByRole('link', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
