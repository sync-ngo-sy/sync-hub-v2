import { z } from 'zod';
import { messageWordsSchema } from './message-words';

export const messageTemplateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name this template.')
    .max(200, 'Keep the name to 200 characters or fewer.'),
  ...messageWordsSchema.shape,
});

export type MessageTemplateFormValues = z.infer<typeof messageTemplateFormSchema>;
