import type { FieldPath } from 'react-hook-form';
import { type FormRejection, formRejection, isProblem, problemMessage } from '@/lib/api-problem';
import { NAME_TAKEN_PROBLEM } from './problems';
import type { MessageTemplateFormValues } from './schemas/message-template';

type MessageTemplateField = FieldPath<MessageTemplateFormValues>;

const TEMPLATE_FIELD: Record<string, MessageTemplateField> = {
  'body.name': 'name',
  'body.subject': 'subject',
  'body.body': 'body',
};

export function messageTemplateRejection(error: unknown): FormRejection<MessageTemplateField> {
  if (isProblem(error, NAME_TAKEN_PROBLEM)) {
    return {
      fields: [
        {
          name: 'name',
          message: problemMessage(error, 'This Tenant already has a template of that name.'),
        },
      ],
      root: null,
    };
  }

  return formRejection(error, TEMPLATE_FIELD, "This template couldn't be saved.");
}
