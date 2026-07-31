import { z } from 'zod';

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
});

export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
