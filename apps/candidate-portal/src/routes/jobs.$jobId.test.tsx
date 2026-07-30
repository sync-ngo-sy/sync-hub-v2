import { http } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PUBLIC_JOB, problem } from '../features/jobs/testing/fixtures';
import { anonymousShell } from '../testing/handlers';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

describe('job detail', () => {
  it('renders the full public job — description and criteria', async () => {
    anonymousShell();
    server.use(http.get('/v1/jobs/{job_id}', ({ response }) => response(200).json(PUBLIC_JOB)));

    renderApp('/jobs/job_1');

    expect(
      await screen.findByRole('heading', { name: 'Senior Frontend Engineer', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Damascus Tech')).toBeInTheDocument();
    expect(screen.getByText(/Build the candidate portal/)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText(/eligible to work in Syria/)).toBeInTheDocument();
  });

  it('routes Apply into auth carrying a return path when signed out', async () => {
    anonymousShell();
    server.use(http.get('/v1/jobs/{job_id}', ({ response }) => response(200).json(PUBLIC_JOB)));

    const { router } = renderApp('/jobs/job_1');

    await userEvent.click(await screen.findByRole('link', { name: 'Apply now' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: '/jobs/job_1' });
  });

  it('shows a friendly not-found with a browse CTA for an unknown job', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs/{job_id}', ({ response }) =>
        response(404).json(problem(404, 'Not found')),
      ),
    );

    renderApp('/jobs/missing');

    expect(await screen.findByText("This job isn't available")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all jobs' })).toBeInTheDocument();
  });
});
