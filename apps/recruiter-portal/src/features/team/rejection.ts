import type { FieldPath } from 'react-hook-form';
import { type FormRejection, formRejection, isProblem, problemMessage } from '@/lib/api-problem';
import { EMAIL_ALREADY_REGISTERED_PROBLEM } from './problems';
import type { InviteFormValues } from './schemas/invite';

type InviteField = FieldPath<InviteFormValues>;

const INVITE_FIELD: Record<string, InviteField> = {
  'body.full_name': 'full_name',
  'body.email': 'email',
  'body.role': 'role',
};

export function inviteRejection(error: unknown): FormRejection<InviteField> {
  if (isProblem(error, EMAIL_ALREADY_REGISTERED_PROBLEM)) {
    return {
      fields: [
        {
          name: 'email',
          message: problemMessage(error, 'An account already exists for this email address.'),
        },
      ],
      root: null,
    };
  }

  return formRejection(error, INVITE_FIELD, "The invitation couldn't be sent.");
}
