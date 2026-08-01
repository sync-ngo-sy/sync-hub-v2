import { z } from 'zod';
import type { PublicJobQuestion } from '../application';

export interface ApplicationFormValues {
  answers: Record<string, string | undefined>;
}

export function applicationFormSchema(questions: PublicJobQuestion[]) {
  return z
    .object({ answers: z.record(z.string(), z.string().optional()) })
    .superRefine(({ answers }, context) => {
      for (const question of questions) {
        if (!question.is_required) continue;
        const answer = answers[question.id]?.trim();
        if (answer === undefined || answer === '') {
          context.addIssue({
            code: 'custom',
            message: 'Answer this question.',
            path: ['answers', question.id],
          });
        }
      }
    });
}
