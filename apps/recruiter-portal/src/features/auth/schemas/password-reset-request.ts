import { z } from 'zod';
import { email } from './fields';

export const passwordResetRequestSchema = z.object({ email });

export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;
