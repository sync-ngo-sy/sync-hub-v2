import { http, PROBLEM } from '@sync/api-client/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const anonymous = () => [
  http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
  http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
];

describe('password-reset request', () => {
  it('reports success neutrally on an accepted request', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/password-reset', ({ response }) => response(202).empty()),
    );

    renderApp('/forgot-password');

    await userEvent.type(await screen.findByLabelText('Email'), 'someone@sync.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/we've sent a link to reset its password/i)).toBeInTheDocument();
    // Neutral: the address is never echoed back, so nothing reveals whether it has an account.
    expect(screen.queryByText(/someone@sync.test/)).not.toBeInTheDocument();
  });

  it('validates the email locally before sending', async () => {
    server.use(...anonymous());

    renderApp('/forgot-password');

    await userEvent.type(await screen.findByLabelText('Email'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });
});
