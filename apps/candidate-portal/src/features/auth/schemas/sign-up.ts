import { z } from 'zod';
import { email, newPassword } from './fields';

export const signUpSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name.'),
  email,
  password: newPassword,
});

export type SignUpValues = z.infer<typeof signUpSchema>;
