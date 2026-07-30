import { http, PROBLEM, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const anonymous = () => [
  http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
  http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
];

describe('password-reset confirm', () => {
  it('sets the new password and lands signed in on the authed home', async () => {
    let confirmed = false;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        confirmed ? response(200).json(PROFILE) : response(401).json(PROBLEM),
      ),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/password-reset/confirm', ({ response }) => {
        confirmed = true;
        return response(204).empty();
      }),
      http.post('/v1/auth/login', ({ response }) => response(200).json(PROFILE)),
    );

    const { router } = renderApp('/auth/reset-password?token_hash=good-token&type=recovery');

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@sync.test');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByText('My Applications')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
  });

  it('shows a recovery path when the server rejects the token', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/password-reset/confirm', ({ response }) =>
        response(400).json({ ...PROBLEM, title: 'Bad Request', status: 400 }),
      ),
    );

    renderApp('/auth/reset-password?token_hash=stale-token&type=recovery');

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@sync.test');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByText("This link didn't work")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('shows the recovery path when the link carries no token', async () => {
    server.use(...anonymous());

    renderApp('/auth/reset-password');

    expect(await screen.findByText("This link didn't work")).toBeInTheDocument();
  });
});
