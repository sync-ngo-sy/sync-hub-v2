import type { FieldPath } from 'react-hook-form';
import { problemFields, problemMessage } from '@/lib/api-problem';
import type { NewApplication } from './application';
import type { ApplicationFormValues } from './schemas/application';

type ApplicationField = FieldPath<ApplicationFormValues>;
type SubmittedAnswers = NonNullable<NewApplication['answers']>;

export interface ApplicationRejection {
  fields: { name: ApplicationField; message: string }[];
  root: string | null;
}

function fieldFor(location: string, answers: SubmittedAnswers): ApplicationField | null {
  const match = /^body\.answers\.(\d+)(?:\.|$)/.exec(location);
  if (!match) return null;

  const answer = answers[Number(match[1])];
  return answer ? (`answers.${answer.question_id}` as ApplicationField) : null;
}

export function applicationRejection(
  error: unknown,
  answers: SubmittedAnswers,
): ApplicationRejection {
  const located = problemFields(error).map((entry) => ({
    name: fieldFor(entry.location, answers),
    message: entry.message,
  }));
  const fields = located.filter(
    (entry): entry is { name: ApplicationField; message: string } => entry.name !== null,
  );

  return {
    fields,
    root:
      located.length > 0 && fields.length === located.length
        ? null
        : problemMessage(error, "Your application couldn't be sent."),
  };
}
