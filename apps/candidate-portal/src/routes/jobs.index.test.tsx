import { http } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { makeSummary, problem } from '../features/jobs/testing/fixtures';
import { anonymousShell } from '../testing/handlers';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

describe('browse jobs', () => {
  it('shows layout-matching skeletons while the first page loads', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs', async ({ response }) => {
        await delay('infinite');
        return response(200).json({ items: [], next_cursor: null });
      }),
    );

    const { container } = renderApp('/jobs');

    await waitFor(() =>
      expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument(),
    );
  });

  it('lists published jobs and reveals the next page on Load more', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs', ({ request, response }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (!cursor) {
          return response(200).json({
            items: [makeSummary({ id: 'job_1', title: 'Frontend Engineer' })],
            next_cursor: 'cursor-2',
          });
        }
        return response(200).json({
          items: [makeSummary({ id: 'job_2', title: 'Backend Engineer' })],
          next_cursor: null,
        });
      }),
    );

    renderApp('/jobs');

    expect(await screen.findByRole('link', { name: 'Frontend Engineer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Backend Engineer' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('link', { name: 'Backend Engineer' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument(),
    );
  });

  it('shows a designed empty state when nothing is published', async () => {
    anonymousShell();
    server.use(
      http.get('/v1/jobs', ({ response }) => response(200).json({ items: [], next_cursor: null })),
    );

    renderApp('/jobs');

    expect(await screen.findByText('No open roles right now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Sync' })).toBeInTheDocument();
  });

  it('surfaces an inline error with a working Retry', async () => {
    anonymousShell();
    let failing = true;
    server.use(
      http.get('/v1/jobs', ({ response }) =>
        failing
          ? response(500).json(problem(500, 'Server error'))
          : response(200).json({
              items: [makeSummary({ id: 'job_1', title: 'Frontend Engineer' })],
              next_cursor: null,
            }),
      ),
    );

    renderApp('/jobs');

    expect(await screen.findByText("Couldn't load")).toBeInTheDocument();

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Frontend Engineer' })).toBeInTheDocument();
  });
});
