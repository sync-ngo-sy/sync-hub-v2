import { z } from 'zod';

export const noteTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Write the note.')
    .max(5_000, 'Keep the note to 5,000 characters or fewer.'),
});

export type NoteTextValues = z.infer<typeof noteTextSchema>;
