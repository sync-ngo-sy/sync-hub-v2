import { http, PROBLEM, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const RECRUITER = { ...PROFILE, account_type: 'recruiter' as const };

describe('login flow', () => {
  it('lets an anonymous visitor view the public landing without bouncing to login', async () => {
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.get('/v1/jobs', ({ response }) => response(200).json({ items: [], next_cursor: null })),
    );

    const { router } = renderApp('/');

    expect(
      await screen.findByRole('heading', { name: "Syria's jobs, in one clear place." }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('sends an unauthenticated visitor from a guarded route to login, and back after success', async () => {
    let loggedIn = false;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        loggedIn ? response(200).json(PROFILE) : response(401).json(PROBLEM),
      ),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/login', ({ response }) => {
        loggedIn = true;
        return response(200).json(PROFILE);
      }),
    );

    const { router } = renderApp('/applications');

    await screen.findByRole('button', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ returnTo: '/applications' });

    await userEvent.type(screen.getByLabelText('Email'), 'candidate@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('My Applications')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/applications');
  });

  it('ignores an external returnTo and lands on the in-app home instead', async () => {
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/login', ({ response }) => response(200).json(PROFILE)),
    );

    const { router } = renderApp('/login?returnTo=https://evil.example');

    await userEvent.type(await screen.findByLabelText('Email'), 'candidate@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('My Applications')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/applications');
  });

  it('shows an incorrect-credentials error in-form on a 401 login', async () => {
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/login', ({ response }) => response(401).json(PROBLEM)),
    );

    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'candidate@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  it('shows the Wrong-portal screen naming the Recruiter Portal for a recruiter account', async () => {
    server.use(http.get('/v1/auth/me', ({ response }) => response(200).json(RECRUITER)));

    const { router } = renderApp('/applications');

    expect(await screen.findByText('Wrong portal')).toBeInTheDocument();
    expect(screen.getByText(/Recruiter Portal/)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/wrong-portal'));
  });

  it('redirects to login with return-to when a live session expires mid-session', async () => {
    let live = true;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        live ? response(200).json(PROFILE) : response(401).json(PROBLEM),
      ),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
    );

    const { router, queryClient } = renderApp('/applications');
    expect(await screen.findByText('My Applications')).toBeInTheDocument();

    // The session dies; the next profile fetch 401s, the refresh fails, and the client signals it.
    live = false;
    await queryClient.invalidateQueries();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/applications' });
  });
});
