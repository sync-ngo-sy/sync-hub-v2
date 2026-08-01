import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  refusesTenantSignup,
  signedInAs,
  signedOut,
  signsUpTenant,
} from '@/features/auth/testing/handlers';
import {
  CANDIDATE,
  EMAIL_TAKEN,
  RECRUITER,
  SLUG_TAKEN,
  TENANT_SIGNUP,
  WEAK_PASSWORD,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

async function signUp(user: UserEvent) {
  await user.type(screen.getByLabelText('Workspace name'), TENANT_SIGNUP.tenant.name);
  await user.type(screen.getByLabelText('Workspace address'), TENANT_SIGNUP.tenant.slug);
  await user.type(screen.getByLabelText('Your name'), RECRUITER.full_name);
  await user.type(screen.getByLabelText('Email'), RECRUITER.email);
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'Create workspace' }));
}

describe('creating a Tenant workspace', () => {
  it('creates the workspace and sends the founder to their confirmation email', async () => {
    const request = vi.fn();
    server.use(...signedOut(), ...signsUpTenant(TENANT_SIGNUP, request));

    const { router, user } = await renderApp('/signup');
    await signUp(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/check-email'));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(RECRUITER.email)).toBeVisible();
    expect(request).toHaveBeenCalledWith({
      tenant_name: TENANT_SIGNUP.tenant.name,
      slug: TENANT_SIGNUP.tenant.slug,
      full_name: RECRUITER.full_name,
      email: RECRUITER.email,
      password: 'correct-horse-battery',
    });
  });

  it('validates every required value before asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedOut(), ...signsUpTenant(TENANT_SIGNUP, unexpected));

    const { user } = await renderApp('/signup');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByText('Enter your workspace name.')).toBeVisible();
    expect(screen.getByText('Enter a workspace address.')).toBeVisible();
    expect(screen.getByText('Enter your name.')).toBeVisible();
    expect(screen.getByText('Enter your email.')).toBeVisible();
    expect(screen.getByText('Use at least 8 characters.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it('keeps a taken workspace address beside that field', async () => {
    server.use(...signedOut(), ...refusesTenantSignup(SLUG_TAKEN));

    const { user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(SLUG_TAKEN.detail ?? '');
    expect(screen.getByLabelText('Workspace address')).toHaveAttribute('aria-invalid');
  });

  it.each([
    [EMAIL_TAKEN, 'Email'],
    [WEAK_PASSWORD, 'Password'],
  ])('keeps a rejected value beside its field', async (problem, label) => {
    server.use(...signedOut(), ...refusesTenantSignup(problem));

    const { user } = await renderApp('/signup');
    await signUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(problem.detail ?? '');
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid');
  });

  it('bounces a signed-in recruiter to the Dashboard', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/signup');

    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('sends a signed-in candidate to the Wrong-portal screen', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/signup');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });
});
