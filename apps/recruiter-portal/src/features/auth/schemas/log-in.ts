import { z } from 'zod';

export const logInSchema = z.object({
  email: z.string().min(1, 'Enter your email address').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});

export type LogInValues = z.input<typeof logInSchema>;
