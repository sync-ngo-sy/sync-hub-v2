import { z } from 'zod';
import { email } from './fields';

export const logInSchema = z.object({
  email,
  // Not the sign-up rule: an account made before that rule existed still has to get in.
  password: z.string().min(1, 'Enter your password.'),
});

export type LogInValues = z.infer<typeof logInSchema>;
