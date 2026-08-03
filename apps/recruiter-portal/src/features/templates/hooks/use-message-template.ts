import { api } from '@/lib/api';

export function messageTemplateQuery(templateId: string) {
  return api.queryOptions('get', '/v1/tenants/me/message-templates/{template_id}', {
    params: { path: { template_id: templateId } },
  });
}

export function useMessageTemplate(templateId: string) {
  return api.useQuery(
    'get',
    '/v1/tenants/me/message-templates/{template_id}',
    { params: { path: { template_id: templateId } } },
    { throwOnError: true },
  );
}
