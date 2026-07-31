import type { components } from '@sync/api-client/schema';
import { http, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

type Notification = components['schemas']['Notification'];

const UNREAD: Notification = {
  id: 'n_cv',
  created_at: '2026-07-30T10:00:00Z',
  read_at: null,
  payload: { type: 'cv_parse_failed', cv_id: 'cv_1', display_name: 'resume.pdf' },
};

const READ: Notification = {
  id: 'n_app',
  created_at: '2026-07-30T09:00:00Z',
  read_at: '2026-07-30T09:30:00Z',
  payload: {
    type: 'application_status_changed',
    application_id: 'app_1',
    job_title: 'Frontend Engineer',
    tenant_name: 'Acme',
    status: 'shortlisted',
    previous_status: 'reviewing',
  },
};

function baseHandlers() {
  return [
    http.get('/v1/auth/me', ({ response }) => response(200).json(PROFILE)),
    http.get('/v1/notifications/unread-count', ({ response }) => response(200).json({ unread: 1 })),
  ];
}

describe('notifications view-all page', () => {
  it('shows a designed empty state when there is nothing to show', async () => {
    server.use(
      ...baseHandlers(),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [], next_cursor: null }),
      ),
    );

    renderApp('/notifications');

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('renders both payload types and marks unread items visually distinct', async () => {
    server.use(
      ...baseHandlers(),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [UNREAD, READ], next_cursor: null }),
      ),
    );

    renderApp('/notifications');

    expect(await screen.findByText("We couldn't read your CV")).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Shortlisted')).toBeInTheDocument();

    // Only the one unread item carries the accessible "Unread" marker.
    expect(screen.getAllByText(/Unread\./)).toHaveLength(1);
  });

  it('pages by cursor with Load more, appending the next page', async () => {
    server.use(
      ...baseHandlers(),
      http.get('/v1/notifications', ({ request, response }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return cursor === 'cursor-2'
          ? response(200).json({ items: [READ], next_cursor: null })
          : response(200).json({ items: [UNREAD], next_cursor: 'cursor-2' });
      }),
    );

    renderApp('/notifications');

    expect(await screen.findByText("We couldn't read your CV")).toBeInTheDocument();
    expect(screen.queryByText('Frontend Engineer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument();
    // Last page: the affordance is gone.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument(),
    );
  });

  it('opens an item to its deep link', async () => {
    server.use(
      ...baseHandlers(),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [UNREAD], next_cursor: null }),
      ),
      http.post('/v1/notifications/{notification_id}/read', ({ response }) =>
        response(200).json({ ...UNREAD, read_at: '2026-07-31T00:00:00Z' }),
      ),
    );

    const { router } = renderApp('/notifications');

    await userEvent.click(await screen.findByRole('button', { name: /We couldn't read your CV/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/cvs'));
  });
});
