import { http, PROBLEM, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const anonymous = () => [
  http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
  http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
];

describe('email confirmation', () => {
  it('redeems the token and arrives signed in on the authed home', async () => {
    // Redeeming the link issues the session, so from that point on `/me` answers with the profile.
    let confirmed = false;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        confirmed ? response(200).json(PROFILE) : response(401).json(PROBLEM),
      ),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/confirm-email', ({ response }) => {
        confirmed = true;
        return response(200).json(PROFILE);
      }),
    );

    const { router } = renderApp('/auth/confirm?token_hash=good-token&type=signup');

    expect(await screen.findByText('My Applications')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
  });

  it('shows a recovery path for a spent or expired token, not an error dump', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/confirm-email', ({ response }) =>
        response(400).json({ ...PROBLEM, title: 'Bad Request', status: 400 }),
      ),
    );

    renderApp('/auth/confirm?token_hash=stale-token&type=signup');

    expect(await screen.findByText("This link didn't work")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('shows the recovery path when the link carries no token at all', async () => {
    server.use(...anonymous());

    renderApp('/auth/confirm');

    expect(await screen.findByText("This link didn't work")).toBeInTheDocument();
  });
});
