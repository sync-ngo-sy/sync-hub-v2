import type { components } from '@sync/api-client/schema';
import { http, PROFILE } from '@sync/api-client/testing';
import { focusManager } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../testing/render-app';
import { server } from '../../testing/server';
import { UNREAD_COUNT_POLL_MS } from './hooks/use-unread-count';

type Notification = components['schemas']['Notification'];

const CV_FAILED: Notification = {
  id: 'n_cv',
  created_at: '2026-07-30T10:00:00Z',
  read_at: null,
  payload: { type: 'cv_parse_failed', cv_id: 'cv_1', display_name: 'resume.pdf' },
};

const STATUS_CHANGED: Notification = {
  id: 'n_app',
  created_at: '2026-07-30T09:00:00Z',
  read_at: null,
  payload: {
    type: 'application_status_changed',
    application_id: 'app_1',
    job_title: 'Frontend Engineer',
    tenant_name: 'Acme',
    status: 'shortlisted',
    previous_status: 'reviewing',
  },
};

function authed() {
  return http.get('/v1/auth/me', ({ response }) => response(200).json(PROFILE));
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe('notification bell', () => {
  it('shows the unread count on the bell and re-polls it on an interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let unread = 2;
      server.use(
        authed(),
        http.get('/v1/notifications/unread-count', ({ response }) =>
          response(200).json({ unread }),
        ),
      );

      renderApp('/applications');

      expect(
        await screen.findByRole('button', { name: 'Notifications, 2 unread' }),
      ).toBeInTheDocument();

      unread = 5;
      await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_MS);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Notifications, 5 unread' })).toBeInTheDocument(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-polls the unread count when the window regains focus', async () => {
    let unread = 3;
    server.use(
      authed(),
      http.get('/v1/notifications/unread-count', ({ response }) => response(200).json({ unread })),
    );

    renderApp('/applications');

    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument();

    unread = 0;
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument(),
    );
  });

  it('renders each payload type with its own copy in the dropdown', async () => {
    server.use(
      authed(),
      http.get('/v1/notifications/unread-count', ({ response }) =>
        response(200).json({ unread: 2 }),
      ),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [CV_FAILED, STATUS_CHANGED], next_cursor: null }),
      ),
    );

    renderApp('/applications');

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText("We couldn't read your CV")).toBeInTheDocument();
    expect(screen.getByText(/resume\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    // The application item chips its new status.
    expect(screen.getByText('Shortlisted')).toBeInTheDocument();
  });

  it('marks a notification read and deep-links to CVs on a CV-parse-failure', async () => {
    const readCalls: string[] = [];
    server.use(
      authed(),
      http.get('/v1/notifications/unread-count', ({ response }) =>
        response(200).json({ unread: 1 }),
      ),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [CV_FAILED], next_cursor: null }),
      ),
      http.post('/v1/notifications/{notification_id}/read', ({ params, response }) => {
        readCalls.push(params.notification_id);
        return response(200).json({ ...CV_FAILED, read_at: '2026-07-31T00:00:00Z' });
      }),
    );

    const { router } = renderApp('/applications');

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /We couldn't read your CV/ }),
    );

    await waitFor(() => expect(readCalls).toEqual(['n_cv']));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cvs'));
  });

  it('deep-links a status change to My Applications', async () => {
    server.use(
      authed(),
      http.get('/v1/notifications/unread-count', ({ response }) =>
        response(200).json({ unread: 1 }),
      ),
      http.get('/v1/notifications', ({ response }) =>
        response(200).json({ items: [STATUS_CHANGED], next_cursor: null }),
      ),
      http.post('/v1/notifications/{notification_id}/read', ({ response }) =>
        response(200).json({ ...STATUS_CHANGED, read_at: '2026-07-31T00:00:00Z' }),
      ),
    );

    const { router } = renderApp('/applications');

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Frontend Engineer/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
  });
});
