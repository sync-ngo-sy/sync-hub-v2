import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { logsOut, signedInAsRecruiter, signedOut, signsIn } from '@/features/auth/testing/handlers';
import { client } from '@/lib/api';
import { problem } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { http, server } from '@/testing/server';

type App = Awaited<ReturnType<typeof renderApp>>;

async function signIn({ user }: App) {
  await user.type(await screen.findByLabelText('Email address'), 'rana@aman.test');
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('reaching a guarded route without a session', () => {
  it('redirects to the login page, remembering where the visitor was headed', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/jobs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/jobs' });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('returns to that destination once the sign-in succeeds', async () => {
    server.use(...signsIn());

    const app = await renderApp('/jobs');
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/login'));

    await signIn(app);

    await waitFor(() => expect(app.router.state.location.pathname).toBe('/jobs'));
    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
  });

  it('lands on the Dashboard when there was no destination to return to', async () => {
    server.use(...signsIn());

    const app = await renderApp('/login');
    await signIn(app);

    await waitFor(() => expect(app.router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('a sign-in that fails', () => {
  it('names the problem in the form and stays put', async () => {
    server.use(...signsIn());

    const app = await renderApp('/login');
    await app.user.type(await screen.findByLabelText('Email address'), 'rana@aman.test');
    await app.user.type(screen.getByLabelText('Password'), 'wrong-password');
    await app.user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password do not match an account.',
    );
    expect(app.router.state.location.pathname).toBe('/login');
  });

  it('asks for an email address before sending anything', async () => {
    server.use(...signedOut());

    const app = await renderApp('/login');
    await app.user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });
});

describe('the login page with a session already in hand', () => {
  it('bounces a signed-in recruiter to the Dashboard', async () => {
    server.use(...signedInAsRecruiter());

    const { router } = await renderApp('/login');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('honours a returnTo when bouncing', async () => {
    server.use(...signedInAsRecruiter());

    const { router } = await renderApp('/login?returnTo=%2Ftemplates');

    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'));
  });

  it('ignores an off-site returnTo', async () => {
    server.use(...signedInAsRecruiter());

    const { router } = await renderApp('/login?returnTo=https%3A%2F%2Fevil.test');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('a session that dies while the user is on a loaded page', () => {
  it('is carried to the login page, remembering where they were', async () => {
    server.use(...signedInAsRecruiter(), logsOut());

    const { router } = await renderApp('/jobs');
    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));

    server.use(
      ...signedOut(),
      http.get('/v1/tenants/me', ({ response }) =>
        response(401).json(problem(401, 'Unauthorized')),
      ),
    );
    await client.GET('/v1/tenants/me');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/jobs' });
  });
});

describe('signing out', () => {
  it('returns to the landing page and empties the cache', async () => {
    server.use(...signedInAsRecruiter(), logsOut());

    const { router, queryClient, user } = await renderApp('/dashboard');

    await user.click(await screen.findByRole('button', { name: /Rana Aljabri/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });
});
