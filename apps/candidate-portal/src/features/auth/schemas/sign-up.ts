import { z } from 'zod';
import { email, newPassword } from './fields';

export const signUpSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, 'Enter your name.')
      .max(200, 'Use 200 characters or fewer.'),
    email,
    password: newPassword,
    confirm_password: z.string().min(1, 'Repeat your password.'),
  })
  .refine((values) => values.confirm_password === values.password, {
    path: ['confirm_password'],
    message: 'Both passwords must match.',
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
