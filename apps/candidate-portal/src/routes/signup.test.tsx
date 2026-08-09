import { screen, waitFor, within } from '@testing-library/react';
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

const A_GOOD_PASSWORD = 'CorrectHorse9';

async function signUp(user: UserEvent, password = A_GOOD_PASSWORD, confirmation = password) {
  await user.type(screen.getByLabelText('Full name'), CANDIDATE.full_name);
  await user.type(screen.getByLabelText('Email'), CANDIDATE.email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirmation);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

function requirement(text: string): HTMLElement {
  const line = screen.getByText(text).closest('li');
  if (!line) throw new Error(`No checklist line for ${text}`);
  return line;
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
    expect(screen.getByText('Repeat your password.')).toBeVisible();
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
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

describe('the password checklist', () => {
  it('starts with every requirement unticked', async () => {
    server.use(...signedOut());

    await renderApp('/signup');

    for (const text of [
      'At least 8 characters',
      'An uppercase letter',
      'A lowercase letter',
      'A digit',
    ]) {
      expect(requirement(text)).toHaveAttribute('data-met', 'false');
    }
  });

  it('asks for nothing that is not one of the four requirements', async () => {
    server.use(...signedOut());

    await renderApp('/signup');

    const checklist = screen.getByRole('list', { name: 'Password requirements' });

    expect(within(checklist).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText('A special character')).not.toBeInTheDocument();
  });

  it('ticks each line the moment the typed password satisfies it', async () => {
    server.use(...signedOut());

    const { user } = await renderApp('/signup');
    const field = screen.getByLabelText('Password');

    await user.type(field, 'abc');
    expect(requirement('A lowercase letter')).toHaveAttribute('data-met', 'true');
    expect(requirement('At least 8 characters')).toHaveAttribute('data-met', 'false');
    expect(requirement('An uppercase letter')).toHaveAttribute('data-met', 'false');
    expect(requirement('A digit')).toHaveAttribute('data-met', 'false');

    await user.type(field, 'Defghij');
    expect(requirement('At least 8 characters')).toHaveAttribute('data-met', 'true');
    expect(requirement('An uppercase letter')).toHaveAttribute('data-met', 'true');
    expect(requirement('A digit')).toHaveAttribute('data-met', 'false');

    await user.type(field, '9');
    expect(requirement('A digit')).toHaveAttribute('data-met', 'true');
  });

  it('unticks again when the password is cut back down', async () => {
    server.use(...signedOut());

    const { user } = await renderApp('/signup');
    const field = screen.getByLabelText('Password');

    await user.type(field, A_GOOD_PASSWORD);
    expect(requirement('A digit')).toHaveAttribute('data-met', 'true');

    await user.clear(field);
    expect(requirement('A digit')).toHaveAttribute('data-met', 'false');
    expect(requirement('A lowercase letter')).toHaveAttribute('data-met', 'false');
  });
});

describe('confirming the password', () => {
  it('refuses a confirmation that does not match, without asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...signsUp(CANDIDATE, unexpected));

    const { router, user } = await renderApp('/signup');
    await signUp(user, A_GOOD_PASSWORD, 'CorrectHorse8');

    expect(await screen.findByText('Both passwords must match.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('holds a password that misses a requirement at the form', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...signsUp(CANDIDATE, unexpected));

    const { user } = await renderApp('/signup');
    await signUp(user, 'correcthorse9');

    expect(await screen.findByText('Add an uppercase letter.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it('sends only what the API asked for once both fields agree', async () => {
    const sent = vi.fn();
    server.use(...signedOut(), ...signsUp(CANDIDATE, sent));

    const { user } = await renderApp('/signup');
    await signUp(user);

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(sent).toHaveBeenCalledWith({
      full_name: CANDIDATE.full_name,
      email: CANDIDATE.email,
      password: A_GOOD_PASSWORD,
    });
  });
});

describe('the show/hide toggle', () => {
  it('reveals and re-hides each password field on its own', async () => {
    server.use(...signedOut());

    const { user } = await renderApp('/signup');
    const [passwordToggle, confirmToggle] = screen.getAllByRole('button', {
      name: 'Show password',
    });
    if (!passwordToggle || !confirmToggle) throw new Error('Expected two show-password toggles');

    await user.click(passwordToggle);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');

    await user.click(confirmToggle);
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');

    await user.click(passwordToggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('does not submit the form', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...signsUp(CANDIDATE, unexpected));

    const { user } = await renderApp('/signup');
    const [toggle] = screen.getAllByRole('button', { name: 'Show password' });
    if (!toggle) throw new Error('Expected a show-password toggle');
    await user.click(toggle);

    expect(unexpected).not.toHaveBeenCalled();
    expect(screen.queryByText('Enter your name.')).not.toBeInTheDocument();
  });
});
