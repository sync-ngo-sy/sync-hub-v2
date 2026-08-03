import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type {
  MessageTemplate,
  MessageTemplateChanges,
  NewMessageTemplate,
} from '../message-template';

type Problem = components['schemas']['ProblemDetail'];
type ValidationProblem = components['schemas']['ValidationProblemDetail'];

const NO_SUCH_TEMPLATE: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no message template with that id.',
};

export function listsMessageTemplates(items: MessageTemplate[]) {
  return [
    http.get('/v1/tenants/me/message-templates', ({ response }) => response(200).json(items)),
  ];
}

export function getsMessageTemplate(template: MessageTemplate) {
  return [
    http.get('/v1/tenants/me/message-templates/{template_id}', ({ params, response }) =>
      params.template_id === template.id
        ? response(200).json(template)
        : response(404).json(NO_SUCH_TEMPLATE),
    ),
  ];
}

export function refusesMessageTemplateCreation(problem: ValidationProblem) {
  return [
    http.post('/v1/tenants/me/message-templates', ({ response }) => response(422).json(problem)),
  ];
}

export function refusesMessageTemplateRevision(problem: ValidationProblem) {
  return [
    http.put('/v1/tenants/me/message-templates/{template_id}', ({ response }) =>
      response(422).json(problem),
    ),
  ];
}

export function refusesMessageTemplateDeletion(problem: Problem) {
  return [
    http.delete('/v1/tenants/me/message-templates/{template_id}', ({ response }) =>
      response(404).json(problem),
    ),
  ];
}

export function managesMessageTemplates(
  initial: MessageTemplate[],
  spies: {
    onCreate?: (body: NewMessageTemplate) => void;
    onRevise?: (body: MessageTemplateChanges) => void;
    onDelete?: (templateId: string) => void;
  } = {},
) {
  let templates = [...initial];
  let minted = 0;
  const byName = (one: MessageTemplate, other: MessageTemplate) =>
    one.name.localeCompare(other.name);

  return [
    http.get('/v1/tenants/me/message-templates', ({ response }) =>
      response(200).json([...templates].sort(byName)),
    ),

    http.get('/v1/tenants/me/message-templates/{template_id}', ({ params, response }) => {
      const found = templates.find((template) => template.id === params.template_id);
      return found ? response(200).json(found) : response(404).json(NO_SUCH_TEMPLATE);
    }),

    http.post('/v1/tenants/me/message-templates', async ({ request, response }) => {
      const written = (await request.json()) as NewMessageTemplate;
      spies.onCreate?.(written);
      if (templates.some((template) => template.name === written.name))
        return response(409).json({
          type: 'urn:sync:problem:message-template-name-taken',
          title: 'Conflict',
          status: 409,
          detail: `This tenant already has a message template called “${written.name}”.`,
        });

      minted += 1;
      const saved: MessageTemplate = {
        ...written,
        id: `00000000-0000-4000-8000-0000000009${String(minted).padStart(2, '0')}`,
        created_at: '2026-08-01T12:00:00Z',
        updated_at: '2026-08-01T12:00:00Z',
      };
      templates = [...templates, saved];
      return response(201).json(saved);
    }),

    http.put(
      '/v1/tenants/me/message-templates/{template_id}',
      async ({ params, request, response }) => {
        const changes = (await request.json()) as MessageTemplateChanges;
        spies.onRevise?.(changes);
        const current = templates.find((template) => template.id === params.template_id);
        if (!current) return response(404).json(NO_SUCH_TEMPLATE);

        const revised = { ...current, ...changes, updated_at: '2026-08-02T12:00:00Z' };
        templates = templates.map((template) => (template.id === revised.id ? revised : template));
        return response(200).json(revised);
      },
    ),

    http.delete('/v1/tenants/me/message-templates/{template_id}', ({ params, response }) => {
      if (!templates.some((template) => template.id === params.template_id))
        return response(404).json(NO_SUCH_TEMPLATE);

      spies.onDelete?.(params.template_id);
      templates = templates.filter((template) => template.id !== params.template_id);
      return response(204).empty();
    }),
  ];
}
