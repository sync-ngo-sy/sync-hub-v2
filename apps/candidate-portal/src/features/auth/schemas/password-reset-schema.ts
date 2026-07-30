import { z } from 'zod';

const email = z.string().min(1, 'Enter your email address').email('Enter a valid email address');

export const requestPasswordResetSchema = z.object({ email });

export type RequestPasswordResetValues = z.infer<typeof requestPasswordResetSchema>;

// The confirm leg also takes the email: the API ends every session as it sets the password, so the
// only way to land the user signed in is to log them straight back in with the new credentials.
export const resetPasswordSchema = z.object({
  email,
  password: z.string().min(8, 'Use at least 8 characters'),
});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
