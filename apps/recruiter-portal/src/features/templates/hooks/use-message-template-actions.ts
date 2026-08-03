import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import { messageTemplateQuery } from './use-message-template';
import { messageTemplatesQuery } from './use-message-templates';

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/message-templates', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageTemplatesQuery().queryKey }),
  });
}

export function useReviseMessageTemplate() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/tenants/me/message-templates/{template_id}', {
    onSuccess: (template) => {
      queryClient.setQueryData(messageTemplateQuery(template.id).queryKey, template);
      return queryClient.invalidateQueries({ queryKey: messageTemplatesQuery().queryKey });
    },
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();

  function forget(templateId: string) {
    queryClient.removeQueries({ queryKey: messageTemplateQuery(templateId).queryKey });
    return queryClient.invalidateQueries({ queryKey: messageTemplatesQuery().queryKey });
  }

  return api.useMutation('delete', '/v1/tenants/me/message-templates/{template_id}', {
    onSuccess: (_deleted, variables) => forget(variables.params.path.template_id),
    onError: (error, variables) =>
      isAlreadyGone(error) ? forget(variables.params.path.template_id) : undefined,
  });
}

export function isAlreadyGone(error: unknown): boolean {
  return problemStatus(error) === 404;
}
