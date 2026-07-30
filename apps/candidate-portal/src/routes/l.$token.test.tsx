import { http } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PUBLIC_JOB, problem } from '../features/jobs/testing/fixtures';
import { anonymousShell } from '../testing/handlers';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

describe('tracked-link landing', () => {
  it('resolves the link token to its job in place, with no redirect', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs/by-link/{token}', ({ response }) => response(200).json(PUBLIC_JOB)),
    );

    const { router } = renderApp('/l/abc123');

    expect(
      await screen.findByRole('heading', { name: 'Senior Frontend Engineer', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/l/abc123');
  });

  it('carries the tracked link as the return path when Apply routes into auth', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs/by-link/{token}', ({ response }) => response(200).json(PUBLIC_JOB)),
    );

    const { router } = renderApp('/l/abc123');

    await userEvent.click(await screen.findByRole('link', { name: 'Apply now' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/l/abc123' });
  });

  it('shows a friendly not-found with a browse CTA for a dead link', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs/by-link/{token}', ({ response }) =>
        response(404).json(problem(404, 'Not found')),
      ),
    );

    renderApp('/l/dead');

    expect(await screen.findByText("This job isn't available")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all jobs' })).toBeInTheDocument();
  });
});
