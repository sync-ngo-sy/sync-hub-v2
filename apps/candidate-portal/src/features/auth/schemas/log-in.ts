import { z } from 'zod';
import { email } from './fields';

export const logInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export type LogInValues = z.infer<typeof logInSchema>;
