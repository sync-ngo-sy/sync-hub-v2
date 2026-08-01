import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SUCH_NOTIFICATION } from '@/testing/fixtures';
import type { Notification } from '../notification';

type Problem = components['schemas']['ProblemDetail'];

export function countsUnread(unread: number) {
  return [
    http.get('/v1/notifications/unread-count', ({ response }) => response(200).json({ unread })),
  ];
}

/** Successive answers to the same poll: the last one is repeated once the counts run out. */
export function countsUnreadInTurn(...counts: number[]) {
  let call = 0;
  return [
    http.get('/v1/notifications/unread-count', ({ response }) => {
      const unread = counts[Math.min(call, counts.length - 1)] ?? 0;
      call += 1;
      return response(200).json({ unread });
    }),
  ];
}

export function faultsOnCountingUnread(problem: Problem) {
  return [
    http.get('/v1/notifications/unread-count', ({ response }) => response(500).json(problem)),
  ];
}

/** One page, with nothing after it. */
export function listsNotifications(items: Notification[]) {
  return [
    http.get('/v1/notifications', ({ response }) =>
      response(200).json({ items, next_cursor: null }),
    ),
  ];
}

/**
 * Cursor-keyed pages, as the API hands them over: the cursor names the page that follows, and
 * the last page is the only one that answers with none.
 */
export function listsNotificationPages(...pages: Notification[][]) {
  return [
    http.get('/v1/notifications', ({ query, response }) => {
      const page = Number(query.get('cursor') ?? 0);
      const isLast = page >= pages.length - 1;
      return response(200).json({
        items: pages[page] ?? [],
        next_cursor: isLast ? null : String(page + 1),
      });
    }),
  ];
}

export function faultsOnListingNotifications(problem: Problem) {
  return [http.get('/v1/notifications', ({ response }) => response(500).json(problem))];
}

/** Answers with the notification it was asked about, now carrying a read time — and 404s for an
 * id that belongs to nobody, exactly as the API does. */
export function marksRead(notifications: Notification[], onRequest?: (id: string) => void) {
  return [
    http.post('/v1/notifications/{notification_id}/read', ({ params, response }) => {
      onRequest?.(params.notification_id);
      const found = notifications.find(
        (notification) => notification.id === params.notification_id,
      );
      if (!found) return response(404).json(NO_SUCH_NOTIFICATION);
      return response(200).json({ ...found, read_at: '2026-08-01T09:00:00Z' });
    }),
  ];
}

export function faultsOnMarkingRead(problem: Problem) {
  return [
    http.post('/v1/notifications/{notification_id}/read', ({ response }) =>
      response(500).json(problem),
    ),
  ];
}
