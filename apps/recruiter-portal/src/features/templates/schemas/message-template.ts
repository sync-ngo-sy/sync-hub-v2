import { z } from 'zod';
import { unfillableMessage } from '../placeholders';

const everyPlaceholderFillable = z.string().superRefine((text, ctx) => {
  const unfillable = unfillableMessage(text);
  if (unfillable) ctx.addIssue({ code: 'custom', message: unfillable });
});

export const messageTemplateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name this template.')
    .max(200, 'Keep the name to 200 characters or fewer.'),
  subject: z
    .string()
    .trim()
    .min(1, 'Write a subject line.')
    .max(200, 'Keep the subject to 200 characters or fewer.')
    .pipe(everyPlaceholderFillable),
  body: z
    .string()
    .trim()
    .min(1, 'Write the message.')
    .max(5_000, 'Keep the message to 5,000 characters or fewer.')
    .pipe(everyPlaceholderFillable),
});

export type MessageTemplateFormValues = z.infer<typeof messageTemplateFormSchema>;
