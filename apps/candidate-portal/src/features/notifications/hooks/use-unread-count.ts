import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const unreadCountQuery = api.queryOptions('get', '/v1/notifications/unread-count');

export const UNREAD_POLL_MS = 60_000;

/**
 * The badge is the only thing that tells a Candidate something moved while they were reading
 * something else, so it is polled — and refetched outright when the window comes back, because
 * coming back is exactly the moment a stale number gets believed. Polling pauses on its own while
 * the tab is hidden.
 */
export function useUnreadCount() {
  const count = api.useQuery('get', '/v1/notifications/unread-count', undefined, {
    refetchInterval: UNREAD_POLL_MS,
  });

  const { refetch, error } = count;
  useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refetch]);

  // A bell that cannot count is a bell without a badge, not a panel in the header — so this is
  // the one path a failed count takes to the reporting seam (§7.2).
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Notifications' });
  }, [error]);

  return count;
}
