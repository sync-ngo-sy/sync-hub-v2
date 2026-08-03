import type { FieldPath } from 'react-hook-form';
import { isProblem, problemFields, problemMessage } from '@/lib/api-problem';
import { NAME_TAKEN_PROBLEM } from './problems';
import type { MessageTemplateFormValues } from './schemas/message-template';

type MessageTemplateField = FieldPath<MessageTemplateFormValues>;

interface FieldRejection {
  name: MessageTemplateField;
  message: string;
}

export interface MessageTemplateRejection {
  fields: FieldRejection[];
  root: string | null;
}

const TEMPLATE_FIELD: Record<string, MessageTemplateField> = {
  'body.name': 'name',
  'body.subject': 'subject',
  'body.body': 'body',
};

export function messageTemplateRejection(error: unknown): MessageTemplateRejection {
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

  const located = problemFields(error).map((entry) => ({
    name: TEMPLATE_FIELD[entry.location],
    message: entry.message,
  }));
  const fields = located.filter((entry): entry is FieldRejection => entry.name !== undefined);

  return {
    fields,
    root:
      located.length > 0 && fields.length === located.length
        ? null
        : problemMessage(error, "This template couldn't be saved."),
  };
}
