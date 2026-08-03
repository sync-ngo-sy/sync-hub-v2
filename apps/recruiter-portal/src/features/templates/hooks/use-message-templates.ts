import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function messageTemplatesQuery() {
  return api.queryOptions('get', '/v1/tenants/me/message-templates', {});
}

export function useMessageTemplates() {
  return api.useQuery('get', '/v1/tenants/me/message-templates', {}, { throwOnError: true });
}

export function warmMessageTemplates(queryClient: QueryClient) {
  return queryClient.ensureQueryData(messageTemplatesQuery()).catch(() => undefined);
}
