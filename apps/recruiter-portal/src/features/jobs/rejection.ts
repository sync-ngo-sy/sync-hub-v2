import type { FieldPath } from 'react-hook-form';
import { problemFields, problemMessage } from '@/lib/api-problem';
import type { JobFormValues } from './schemas/job';

const JOB_FIELD: Record<string, FieldPath<JobFormValues>> = {
  'body.title': 'title',
  'body.description': 'description',
  'body.location': 'location',
  'body.employment_type': 'employmentType',
  'body.expires_at': 'expiresAt',
};

export function jobFormRejection(error: unknown) {
  const located = problemFields(error).map((entry) => ({
    name: JOB_FIELD[entry.location],
    message: entry.message,
  }));
  const fields = located.filter(
    (entry): entry is { name: FieldPath<JobFormValues>; message: string } =>
      entry.name !== undefined,
  );

  return {
    fields,
    root:
      located.length > 0 && fields.length === located.length
        ? null
        : problemMessage(error, "This Job couldn't be saved."),
  };
}
