import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { NOTIFICATIONS_QUERY_KEY } from './use-notifications';

/** Marks one notification read, then refreshes the bell count and the notification list. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const mutation = api.useMutation('post', '/v1/notifications/{notification_id}/read');

  return async (notificationId: string) => {
    await mutation.mutateAsync({ params: { path: { notification_id: notificationId } } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['get', '/v1/notifications/unread-count'] }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    ]);
  };
}
