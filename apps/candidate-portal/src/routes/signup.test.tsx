import { http, PROBLEM, PROFILE } from '@sync/api-client/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const anonymous = () => [
  http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
  http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
];

describe('sign-up flow', () => {
  it('validates locally before touching the server', async () => {
    server.use(...anonymous());

    renderApp('/signup');

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
  });

  it('lands on check-your-email after a successful sign-up', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/signup', ({ response }) => response(201).json(PROFILE)),
    );

    const { router } = renderApp('/signup');

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('ada@sync.test')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/check-email');
  });

  it('renders a 409 from the server against the email field', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/signup', ({ response }) =>
        response(409).json({ ...PROBLEM, title: 'Conflict', status: 409 }),
      ),
    );

    renderApp('/signup');

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'taken@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account already exists for this email address.'),
    ).toBeInTheDocument();
  });

  it('renders a 400 password rejection against the password field', async () => {
    server.use(
      ...anonymous(),
      http.post('/v1/auth/signup', ({ response }) =>
        response(400).json({ ...PROBLEM, title: 'Bad Request', status: 400 }),
      ),
    );

    renderApp('/signup');

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@sync.test');
    await userEvent.type(screen.getByLabelText('Password'), 'password12');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('That password was rejected. Choose a stronger one.'),
    ).toBeInTheDocument();
  });
});
