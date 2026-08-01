import { z } from 'zod';
import { newPassword } from './fields';

export const newPasswordSchema = z.object({ password: newPassword });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
