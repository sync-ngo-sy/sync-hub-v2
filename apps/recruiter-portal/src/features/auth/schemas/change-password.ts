import { z } from 'zod';
import { newPassword } from './fields';

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Enter your current password.'),
  new_password: newPassword,
});

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
